const OpenAI = require('openai');
const logger = require('../config/logging');
const ChatMemoryFact = require('../models/ChatMemoryFact');

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

async function maxSimilarityForUser(embedding, userId, chatbotIdFilter) {
  const q = { userId };
  if (chatbotIdFilter !== undefined) q.chatbotId = chatbotIdFilter;
  const docs = await ChatMemoryFact.find(q).select('embedding').lean();
  let best = 0;
  for (const d of docs) {
    const s = cosineSimilarity(embedding, d.embedding);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Helper to resolve the most permanent identity (Device-Agnostic Memory)
 */
const getIdentityId = (userId, phone) => {
  if (phone) return String(phone).replace(/\D/g, '');
  return String(userId);
};

async function extractFactsFromChat(history) {
  try {
    const openai = getOpenAI();
    const chatText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a Fact Extraction AI. Build a profile of the USER.

          🚨 STRICT RULES FOR EXTRACTION:
          1. **Subject Normalization (CRITICAL):**
             - ALWAYS start facts with "User...".
             - Example: "User runs a coaching business", "User's name is Rahul".
             - NEVER use "I" or the user's actual name as the subject.

          2. **Identity vs. Interest:**
             - "I run a salon" -> EXTRACT: "User's business is a Salon".
             - "I want a salon bot" -> IGNORE (Interest).

          3. **Only Explicit Facts:** Name, Contact, Business Type, Budget, Constraints, Location.

          Output JSON: { "facts": ["User's name is X", "User runs a X business"] }`,
        },
        { role: 'user', content: `CONVERSATION:\n${chatText}` },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.facts || [];
  } catch (e) {
    logger.error('Fact Extraction Failed', e);
    return [];
  }
}

async function consolidateChatToMemory(userId, chatbotId, sessionId, chatHistory, phone = null) {
  try {
    if (!chatHistory || chatHistory.length === 0) return;
    const facts = await extractFactsFromChat(chatHistory);
    if (!Array.isArray(facts) || facts.length === 0) return;

    const identityId = getIdentityId(userId, phone);
    const openai = getOpenAI();
    const toInsert = [];

    for (const fact of facts) {
      if (!fact || fact.trim().length < 5) continue;

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: fact.trim(),
      });
      const vector = response.data[0].embedding;

      const best = await maxSimilarityForUser(vector, identityId);
      if (best > 0.85) {
        logger.info(`♻️ [Memory] Fact already known: "${fact}" (Score: ${best})`);
        continue;
      }

      toInsert.push({
        userId: identityId,
        chatbotId: chatbotId.toString(),
        content: fact.trim(),
        embedding: vector,
        sourceSessionId: sessionId,
        phone: phone ? identityId : null,
        is_authenticated: !!phone,
        createdAt: new Date(),
      });
    }

    if (toInsert.length > 0) {
      await ChatMemoryFact.insertMany(toInsert);
      logger.info(`✅ [Memory] Saved ${toInsert.length} new facts (MongoDB).`);
    }
  } catch (error) {
    logger.error(`❌ [Memory] Save Error: ${error.message}`);
  }
}

async function retrieveUserContext(userId, userQuery, chatbotId, phone = null) {
  try {
    const identityId = getIdentityId(userId, phone);
    const openai = getOpenAI();
    let searchInput = userQuery;

    const isGreeting = /^(hello|hi|hey|good\s*(morning|afternoon|evening)|greetings|start|yo|ola)/i.test(
      userQuery.trim(),
    );

    if (isGreeting || userQuery.trim().length < 5) {
      logger.info('🔍 [Memory] Greeting Detected - Fetching Full Profile...');
      searchInput = "User's name, business type, industry, location, budget, contact info";
    } else {
      searchInput = `User context for: "${userQuery}". User's name, business, location.`;
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchInput,
    });
    const queryVec = response.data[0].embedding;

    const docs = await ChatMemoryFact.find({
      userId: identityId,
      chatbotId: chatbotId.toString(),
    })
      .select('content embedding')
      .lean();

    const threshold = 0.22;
    const scored = docs
      .map(d => ({ content: d.content, score: cosineSimilarity(queryVec, d.embedding) }))
      .filter(m => m.score > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) return '';

    logger.info(`✅ [Memory] Retrieved ${scored.length} facts (MongoDB).`);

    return `USER LONG-TERM CONTEXT:\n${scored.map(m => `- ${m.content}`).join('\n')}`;
  } catch (err) {
    logger.error(`❌ [Memory] Retrieve Error: ${err.message}`);
    return '';
  }
}

async function saveExplicitMemory(userId, chatbotId, fact, phone = null) {
  try {
    const identityId = getIdentityId(userId, phone);
    const openai = getOpenAI();
    const cleanFact = fact.trim();
    if (!cleanFact) return;

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: cleanFact,
    });
    const vector = response.data[0].embedding;

    const best = await maxSimilarityForUser(vector, identityId, chatbotId.toString());
    if (best > 0.9) {
      logger.info(`♻️ [Memory] Explicit fact exists: "${cleanFact}" (Skipping)`);
      return;
    }

    await ChatMemoryFact.create({
      userId: identityId,
      chatbotId: chatbotId.toString(),
      content: cleanFact,
      embedding: vector,
      sourceSessionId: 'system_auth_event',
      phone: phone ? String(phone).replace(/\D/g, '') : null,
      is_authenticated: !!phone,
      createdAt: new Date(),
    });
    logger.info(`✅ [Memory] Explicit fact saved: "${cleanFact}"`);
  } catch (error) {
    logger.error(`❌ [Memory] Explicit Save Error: ${error.message}`);
  }
}

module.exports = {
  consolidateChatToMemory,
  retrieveUserContext,
  saveExplicitMemory,
  getUserMemoryStats: async () => ({}),
  cleanupOldMemories: async () => ({}),
};
