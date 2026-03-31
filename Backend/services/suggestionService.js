/**
 * Chat autocomplete (merge order):
 * 1) KB — GPT-seeded questions from uploads (suggestions:kb) — refreshes when knowledge is added/updated.
 * 2) Personal — this session/user’s recent questions (recency), prefix match, no min count.
 * 3) Popular — same normalized question asked often (suggestions:popular + legacy global), score ≥ POPULAR_SUGGESTION_MIN.
 * 4) Context — topic hints (billing / support / onboarding).
 * Uses ZREVRANGE / ZREVRANGEBYSCORE via sendCommand for older Redis servers.
 */
const { getClient } = require('../lib/redis');
const logger = require('../config/logging');
const { kbEmbKey } = require('./kbSuggestionExtractor');

const MAX_QUERY_LEN = 2000;
const MAX_PREFIX_LEN = 500;
const MAX_RESULTS = Number(process.env.SUGGESTION_MAX_RESULTS) || 3;
const GLOBAL_FETCH_CAP = 200;
const USER_FETCH_CAP = 200;
/** Min times a question was recorded before it appears as “popular” (same normalized string). Default 2 = after 2 sends. */
const POPULAR_MIN_SCORE = Number(process.env.POPULAR_SUGGESTION_MIN) || 2;
const SUGGESTION_MAX_LEN = Number(process.env.SUGGESTION_MAX_LEN) || 120;
const SUGGESTION_MIN_WORDS = Number(process.env.SUGGESTION_MIN_WORDS) || 3;
/** Typed prefix must contain at least this many words before any suggestions are returned. */
const PREFIX_MIN_WORDS = Number(process.env.SUGGESTION_PREFIX_MIN_WORDS) || 2;
/**
 * When no prefix match, rank KB questions by embedding similarity to the typed prefix (requires reseed after KB change).
 * Off if SUGGESTION_SEMANTIC_FALLBACK=false.
 */
const SEMANTIC_FALLBACK_ENABLED = process.env.SUGGESTION_SEMANTIC_FALLBACK !== 'false';
/**
 * Optional: when no prefix match and semantic pack missing or fails, fill from raw KB list (unordered).
 * Off by default — set SUGGESTION_DISCOVERY_ENABLED=true to re-enable.
 */
const DISCOVERY_ENABLED = process.env.SUGGESTION_DISCOVERY_ENABLED === 'true';
const DISCOVERY_MIN_WORDS = Number(process.env.SUGGESTION_DISCOVERY_MIN_WORDS) || 3;

/** Whole-line greetings / noise only (personal & popular history, not just KB extractor). */
const BLOCKED_INPUTS = /^(hi+|hello|hey|helo|ok|okay|yes|no|bye|thanks)\s*$/i;

/**
 * Filters junk suggestions from every source (KB, personal, popular, context).
 */
function isValidSuggestion(q) {
  if (!q || typeof q !== 'string') return false;
  const t = q.trim();
  if (t.length > SUGGESTION_MAX_LEN) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < SUGGESTION_MIN_WORDS) return false;
  if (BLOCKED_INPUTS.test(t)) return false;
  return true;
}

/** Substrings that disqualify a suggestion from being shown or stored (lowercase match). */
const DEFAULT_BLOCKED = ['abuse', 'hack', 'spam', 'exploit', 'malware'];

function getBlockedTerms() {
  const extra = (process.env.SUGGESTION_BLOCKED_TERMS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_BLOCKED, ...extra])];
}

const CONTEXT_SUGGESTIONS = {
  billing: [
    'what is my balance',
    'how to pay invoice',
    'how to download receipt',
    'subscription renewal date',
    'what is refund status',
  ],
  support: [
    'track my order',
    'raise a complaint',
    'speak to agent',
    'open a ticket',
  ],
  onboarding: [
    'how to get started',
    'setup my account',
    'how to watch demo',
    'how to connect integrations',
  ],
};

function kbKey(chatbotId) {
  return `suggestions:kb:${String(chatbotId)}`;
}

/** Frequency counts (same as "popular asked" in product docs). */
function popularKey(chatbotId) {
  return `suggestions:popular:${String(chatbotId)}`;
}

/** Legacy global key — still read for popularity ≥ min so existing installs keep data. */
function globalKey(chatbotId) {
  return `suggestions:global:${String(chatbotId)}`;
}

function userKey(chatbotId, userId) {
  return `suggestions:user:${String(chatbotId)}:${String(userId)}`;
}

function contextRedisKey(chatbotId, topic) {
  return `suggestions:context:${String(chatbotId)}:${String(topic)}`;
}

function normalizeQuery(q) {
  return String(q || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY_LEN);
}

function isClean(query, blocked) {
  const lower = String(query).toLowerCase();
  return !blocked.some((term) => lower.includes(term));
}

/**
 * Match typed prefix to a suggestion: leading text first, then substring (so KB lines like
 * "How do I reach you if I need what is your address" still match "what is your").
 * Substring fallback only for prefixes of 3+ chars to limit noise on 2-letter input.
 */
function matchesPrefix(suggestion, prefixLower) {
  const s = String(suggestion).toLowerCase();
  const p = prefixLower.trim();
  if (!p) return true;
  if (s.startsWith(p)) return true;
  if (p.length >= 3 && s.includes(p)) return true;
  return false;
}

function prefixMatch(list, prefixLower) {
  return list.filter((q) => matchesPrefix(q, prefixLower));
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * @returns {Promise<string[]|null>} ordered suggestions or null if unavailable
 */
async function getSemanticKbSuggestions(client, chatbotId, prefixLower, blocked) {
  let raw;
  try {
    raw = await client.get(kbEmbKey(chatbotId));
  } catch (e) {
    return null;
  }
  if (!raw || typeof raw !== 'string') return null;
  let pack;
  try {
    pack = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const items = pack.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const model = pack.model || 'text-embedding-3-small';
  if (!process.env.OPENAI_API_KEY) return null;

  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let qEmb;
  try {
    const resp = await openai.embeddings.create({
      model,
      input: prefixLower.trim(),
    });
    qEmb = resp.data[0]?.embedding;
  } catch (e) {
    logger.warn('Suggestions: semantic prefix embed failed', e.message);
    return null;
  }
  if (!Array.isArray(qEmb) || qEmb.length === 0) return null;

  const minSimEnv = process.env.SUGGESTION_SEMANTIC_MIN_SCORE;
  const floor =
    minSimEnv !== undefined && minSimEnv !== '' && !Number.isNaN(Number(minSimEnv))
      ? Number(minSimEnv)
      : null;

  const scored = [];
  for (const it of items) {
    const text = it.text;
    const emb = it.embedding;
    if (!isValidSuggestion(text) || !isClean(text, blocked)) continue;
    if (!Array.isArray(emb) || emb.length !== qEmb.length) continue;
    scored.push({ text, score: cosineSimilarity(qEmb, emb) });
  }
  scored.sort((x, y) => y.score - x.score);

  const picked = [];
  const seen = new Set();
  for (const { text, score } of scored) {
    if (floor != null && score < floor) continue;
    const n = String(text).toLowerCase();
    if (seen.has(n)) continue;
    seen.add(n);
    picked.push(text);
    if (picked.length >= MAX_RESULTS) break;
  }
  return picked.length > 0 ? picked : null;
}

function mergeDedupeOrdered(lists, limit, predicate) {
  const seen = new Set();
  const out = [];
  const ok = predicate || (() => true);
  for (const list of lists) {
    for (const q of list) {
      if (!ok(q)) continue;
      const n = String(q).toLowerCase();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(String(q));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

async function zRevRangeMembers(client, key, start, stop) {
  const raw = await client.sendCommand(['ZREVRANGE', key, String(start), String(stop)]);
  return Array.isArray(raw) ? raw : [];
}

/** Members with score between min and max (inclusive), highest scores first. */
async function zRevRangeByScoreMembers(client, key, minScore, maxScore, limit) {
  try {
    const raw = await client.sendCommand([
      'ZREVRANGEBYSCORE',
      key,
      String(maxScore),
      String(minScore),
      'LIMIT',
      '0',
      String(limit),
    ]);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

async function getPopularMembers(client, chatbotId) {
  const pk = popularKey(chatbotId);
  const gk = globalKey(chatbotId);
  const min = POPULAR_MIN_SCORE;
  const max = '+inf';
  const [fromPopular, fromLegacy] = await Promise.all([
    zRevRangeByScoreMembers(client, pk, min, max, GLOBAL_FETCH_CAP),
    zRevRangeByScoreMembers(client, gk, min, max, GLOBAL_FETCH_CAP),
  ]);
  const seen = new Set();
  const out = [];
  for (const q of [...fromPopular, ...fromLegacy]) {
    const n = String(q).toLowerCase();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(String(q));
  }
  return out;
}

async function getContextList(client, chatbotId, topic) {
  const staticList = CONTEXT_SUGGESTIONS[topic] || [];
  let redisList = [];
  try {
    redisList = await client.sMembers(contextRedisKey(chatbotId, topic));
  } catch (e) {
    /* ignore */
  }
  const merged = [...staticList, ...(Array.isArray(redisList) ? redisList : [])];
  return [...new Set(merged.map((s) => String(s).trim()).filter(Boolean))];
}

/**
 * @param {string} chatbotId
 * @param {string} userId - session or stable user key from client
 * @param {string} prefix - raw prefix from input
 * @param {string} [context] - optional: billing | support | onboarding
 */
async function getSuggestions(chatbotId, userId, prefix, context) {
  const blocked = getBlockedTerms();
  const prefixLower = String(prefix || '').trim().toLowerCase().slice(0, MAX_PREFIX_LEN);
  const prefixWordCount = prefixLower.split(/\s+/).filter(Boolean).length;
  if (prefixWordCount < PREFIX_MIN_WORDS || !chatbotId) {
    return [];
  }

  let client;
  try {
    client = await getClient();
  } catch (e) {
    logger.warn('Suggestions: Redis unavailable', e.message);
    return [];
  }

  const uKey = userKey(chatbotId, userId || 'anonymous');

  let kbRaw = [];
  let personalRaw = [];
  let popularRaw = [];
  let contextPhrases = [];

  try {
    const kbPromise = zRevRangeMembers(client, kbKey(chatbotId), 0, GLOBAL_FETCH_CAP - 1);
    const personalPromise = userId
      ? zRevRangeMembers(client, uKey, 0, USER_FETCH_CAP - 1)
      : Promise.resolve([]);
    const popularPromise = getPopularMembers(client, chatbotId);
    const contextPromise = context
      ? getContextList(client, chatbotId, context)
      : Promise.resolve([]);

    const [kb, p, pop, ctx] = await Promise.all([
      kbPromise,
      personalPromise,
      popularPromise,
      contextPromise,
    ]);
    kbRaw = kb;
    personalRaw = p;
    popularRaw = pop;
    contextPhrases = ctx;
  } catch (e) {
    logger.error('Suggestions: Redis read error', e);
    return [];
  }

  const kbMatches = prefixMatch(kbRaw, prefixLower);
  const personalMatches = prefixMatch(personalRaw, prefixLower);
  const popularMatches = prefixMatch(popularRaw, prefixLower);
  const contextMatches = context ? prefixMatch(contextPhrases, prefixLower) : [];

  const merged = mergeDedupeOrdered(
    [kbMatches, personalMatches, popularMatches, contextMatches],
    MAX_RESULTS,
    (q) => isValidSuggestion(q) && isClean(q, blocked)
  );
  if (merged.length > 0) {
    return merged;
  }

  if (SEMANTIC_FALLBACK_ENABLED && kbRaw.length > 0) {
    try {
      const semantic = await getSemanticKbSuggestions(client, chatbotId, prefixLower, blocked);
      if (semantic && semantic.length > 0) {
        return semantic;
      }
    } catch (e) {
      logger.warn('Suggestions: semantic KB error', e.message);
    }
  }

  if (
    DISCOVERY_ENABLED &&
    prefixWordCount >= DISCOVERY_MIN_WORDS &&
    kbRaw.length > 0
  ) {
    const discovery = kbRaw
      .filter((q) => isValidSuggestion(q) && isClean(q, blocked))
      .slice(0, MAX_RESULTS);
    if (discovery.length > 0) {
      return discovery;
    }
  }

  return [];
}

/**
 * Increment popular frequency and refresh personal recency (ZSET score = unix seconds).
 */
async function recordQuery(chatbotId, userId, query) {
  const blocked = getBlockedTerms();
  const normalized = normalizeQuery(query);
  if (normalized.length < 2 || !chatbotId || !isClean(normalized, blocked)) {
    return { ok: false, reason: 'skipped' };
  }
  if (!isValidSuggestion(normalized)) {
    return { ok: false, reason: 'invalid_suggestion' };
  }

  let client;
  try {
    client = await getClient();
  } catch (e) {
    logger.warn('Suggestions record: Redis unavailable', e.message);
    return { ok: false, reason: 'redis' };
  }

  const score = Date.now() / 1000;
  const pk = popularKey(chatbotId);
  const gk = globalKey(chatbotId);
  const uKey = userKey(chatbotId, userId || 'anonymous');

  try {
    await client.zIncrBy(pk, 1, normalized);
    await client.zIncrBy(gk, 1, normalized);
    if (userId) {
      await client.zAdd(uKey, [{ score, value: normalized }]);
    }
  } catch (e) {
    logger.error('Suggestions record: Redis write error', e);
    return { ok: false, reason: 'write' };
  }

  return { ok: true };
}

module.exports = {
  getSuggestions,
  recordQuery,
  isClean,
  isValidSuggestion,
  matchesPrefix,
  getBlockedTerms,
  CONTEXT_SUGGESTIONS,
  cosineSimilarity,
};
