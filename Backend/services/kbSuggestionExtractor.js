/**
 * When the knowledge base changes, GPT-4o mini generates natural questions and seeds Redis (high-priority KB suggestions).
 */
const OpenAI = require('openai');
const mongoose = require('mongoose');
const Chatbot = require('../models/Chatbot');
const Embedding = require('../models/Embedding');
const { getClient } = require('../lib/redis');
const logger = require('../config/logging');

const KB_TEXT_MAX = Number(process.env.KB_SUGGESTION_TEXT_MAX) || 10000;
const KB_QUESTION_COUNT = Number(process.env.KB_SUGGESTION_COUNT) || 20;

function kbKey(chatbotId) {
  return `suggestions:kb:${String(chatbotId)}`;
}

/** Redis JSON blob: { model, items: [{ text, embedding }] } for semantic suggestion ranking. */
function kbEmbKey(chatbotId) {
  return `suggestions:kb:emb:${String(chatbotId)}`;
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function buildKbCorpusText(chatbotId) {
  const chatbot = await Chatbot.findById(chatbotId).lean();
  if (!chatbot) {
    throw new Error('Chatbot not found');
  }

  const parts = [];
  for (const doc of chatbot.knowledgeBase || []) {
    const title = doc.title || 'Untitled';
    const content = doc.content || '';
    if (content.trim()) {
      parts.push(`Title: ${title}\n${content}`);
    }
  }

  const oid = new mongoose.Types.ObjectId(chatbotId);
  const chunks = await Embedding.find({ chatbotId: oid })
    .select('content metadata')
    .limit(120)
    .lean();

  for (const ch of chunks) {
    const title = ch.metadata?.title || ch.metadata?.filename || 'Document chunk';
    const content = ch.content || '';
    if (content.trim()) {
      parts.push(`Title: ${title}\n${content}`);
    }
  }

  return parts.join('\n\n---\n\n').slice(0, KB_TEXT_MAX);
}

/**
 * Parse JSON object output; supports { questions: [...] } or a top-level array if the model returns one.
 */
function parseQuestionsFromOpenAIContent(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.questions)) {
    return parsed.questions;
  }
  const firstArray = Object.values(parsed || {}).find((v) => Array.isArray(v));
  if (Array.isArray(firstArray)) return firstArray;
  return [];
}

/**
 * @param {string} chatbotId
 * @returns {Promise<string[]>} seeded questions (display strings)
 */
async function extractSuggestionsFromKB(chatbotId) {
  const openai = getOpenAI();
  if (!openai) {
    logger.warn('[KB suggestions] OPENAI_API_KEY not set; skipping extraction');
    return [];
  }

  const combinedText = await buildKbCorpusText(chatbotId);
  if (!combinedText.trim()) {
    logger.info(`[KB suggestions] No KB text for bot ${chatbotId}; clearing Redis KB key`);
    const client = await getClient().catch(() => null);
    if (client) {
      await client.del(kbKey(chatbotId)).catch(() => {});
      await client.del(kbEmbKey(chatbotId)).catch(() => {});
    }
    return [];
  }

  const model = process.env.KB_SUGGESTION_MODEL || 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 800,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that generates natural user questions from business knowledge base content. ' +
          'Include several phrasings visitors actually type, including conversational openers like "Tell me about..." or "What can you tell me about..." when they fit the content. ' +
          'Always return ONLY a valid JSON object with a single key "questions" whose value is an array of strings. ' +
          'No markdown, no code fences, no extra keys.',
      },
      {
        role: 'user',
        content: `Based on this knowledge base, generate exactly ${KB_QUESTION_COUNT} natural questions a website visitor would ask.

Rules:
- Questions must be directly answerable from the content
- Write as a real user would type (natural, casual)
- No greetings (hi, hello, hey)
- Minimum 3 words per question
- Mix short and detailed questions
- Return ONLY this JSON shape: {"questions": ["question 1", "question 2", ...]}

Knowledge Base:
${combinedText}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || '';
  let questions = [];
  try {
    questions = parseQuestionsFromOpenAIContent(raw);
  } catch (e) {
    logger.error('[KB suggestions] Failed to parse OpenAI JSON:', e.message, raw?.slice(0, 200));
    throw e;
  }

  const filtered = questions
    .map((q) => String(q).trim().replace(/\s+/g, ' '))
    .filter((q) => {
      const words = q.split(/\s+/).filter(Boolean);
      return (
        words.length >= 3 &&
        q.length <= 120 &&
        !q.match(/^(hi|hello|hey|ok|yes|no)\b/i)
      );
    })
    .slice(0, 25);

  const key = kbKey(chatbotId);
  const embKey = kbEmbKey(chatbotId);
  const client = await getClient();
  const KB_SCORE = 100;
  await client.del(key);
  await client.del(embKey);
  for (const q of filtered) {
    await client.zAdd(key, { score: KB_SCORE, value: q });
  }

  const embedModel = process.env.KB_SUGGESTION_EMBED_MODEL || 'text-embedding-3-small';
  try {
    const embResp = await openai.embeddings.create({
      model: embedModel,
      input: filtered,
    });
    const byIndex = new Map(
      (embResp.data || []).map((d) => [d.index, d.embedding])
    );
    const items = filtered.map((text, i) => ({
      text,
      embedding: byIndex.get(i),
    })).filter((x) => Array.isArray(x.embedding) && x.embedding.length > 0);
    if (items.length > 0) {
      await client.set(
        embKey,
        JSON.stringify({ model: embedModel, items })
      );
      logger.info(
        `[KB suggestions] Stored ${items.length} embedding vectors (${embedModel}) for bot ${chatbotId}`
      );
    }
  } catch (e) {
    logger.warn('[KB suggestions] Embedding cache failed (semantic fallback disabled until reseed):', e.message);
  }

  logger.info(`[KB suggestions] GPT-4o mini seeded ${filtered.length} KB suggestions for bot ${chatbotId}`);
  return filtered;
}

function scheduleKbReseed(chatbotId) {
  if (!chatbotId) return;
  setImmediate(() => {
    extractSuggestionsFromKB(String(chatbotId)).catch((err) => {
      logger.error('[KB suggestions] Re-seed failed:', err.message);
    });
  });
}

module.exports = {
  extractSuggestionsFromKB,
  scheduleKbReseed,
  kbKey,
  kbEmbKey,
};
