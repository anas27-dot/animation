#!/usr/bin/env node
/**
 * Smoke test for GET /api/chat/suggestions (and optional Redis KB key).
 *
 * Usage:
 *   1. Start API: npm run dev   (or npm start)
 *   2. From repo root: npm run test:suggestions
 *
 * Env (optional, see .env):
 *   TEST_API_BASE   — default http://localhost:5000/api
 *   TEST_CHATBOT_ID — required for meaningful test (falls back to first arg)
 *   TEST_PREFIX     — default "tell me about" (2+ words)
 *
 * Example:
 *   TEST_CHATBOT_ID=69ca1a76a29bde2613959b78 node scripts/test-suggestions.js
 */

require('dotenv').config();

const API_BASE = (process.env.TEST_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const CHATBOT_ID =
  process.env.TEST_CHATBOT_ID || process.argv[2] || process.env.CHATBOT_ID || '';
const PREFIX = process.env.TEST_PREFIX || 'tell me about';
const USER_ID = process.env.TEST_USER_ID || 'test_session_smoke';

let failures = 0;

function fail(msg) {
  console.error(`❌ ${msg}`);
  failures += 1;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

async function httpJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text };
  }
  return { res, data };
}

async function main() {
  console.log('--- Suggestion API smoke test ---\n');
  console.log(`API_BASE:     ${API_BASE}`);
  console.log(`CHATBOT_ID:   ${CHATBOT_ID || '(not set — use TEST_CHATBOT_ID or arg)'}`);
  console.log(`PREFIX:       "${PREFIX}"`);
  console.log('');

  // 1) Health
  const healthUrl = API_BASE.replace(/\/api$/, '') + '/health';
  try {
    const { res, data } = await httpJson(healthUrl);
    if (res.ok && data.status === 'ok') {
      ok(`GET /health → ${res.status} (${data.status})`);
    } else {
      fail(`GET /health → ${res.status} ${JSON.stringify(data)}`);
    }
  } catch (e) {
    fail(`GET /health failed: ${e.message}`);

    console.error('\n   Is the server running? Try: npm run dev\n');
    process.exit(1);
  }

  if (!CHATBOT_ID) {
    fail('Set TEST_CHATBOT_ID in .env or pass Mongo chatbot _id as first argument.');
    console.error('\n   Example: TEST_CHATBOT_ID=yourId npm run test:suggestions\n');
    process.exit(failures ? 1 : 0);
  }

  // 2) Suggestions (needs 2+ words in prefix for current API rules)
  const params = new URLSearchParams({
    chatbotId: CHATBOT_ID,
    userId: USER_ID,
    prefix: PREFIX,
  });
  const sugUrl = `${API_BASE}/chat/suggestions?${params}`;

  try {
    const { res, data } = await httpJson(sugUrl);
    if (!res.ok) {
      fail(`GET /chat/suggestions → ${res.status} ${JSON.stringify(data)}`);
    } else if (!Array.isArray(data.suggestions)) {
      fail(`Response missing suggestions array: ${JSON.stringify(data)}`);
    } else {
      const n = data.suggestions.length;
      ok(`GET /chat/suggestions → ${res.status}, ${n} suggestion(s)`);
      if (n > 0) {
        data.suggestions.slice(0, 5).forEach((s, i) => {
          console.log(`   ${i + 1}. ${String(s).slice(0, 100)}${String(s).length > 100 ? '…' : ''}`);
        });
        if (n > 5) console.log(`   … ${n - 5} more`);
      } else {
        console.log(
          '\n   ℹ️  Empty list is OK if KB was never reseeded or Redis has no data.\n' +
            '   Run: POST /api/chat/suggestions/reseed-kb/' +
            CHATBOT_ID +
            ' (with X-Admin-Key if required)\n'
        );
      }
    }
  } catch (e) {
    fail(`GET /chat/suggestions failed: ${e.message}`);
  }

  // 3) Optional: Redis KB key count (same host as app .env)
  try {
    const { getClient, disconnect } = require('../lib/redis');
    const client = await getClient();
    const key = `suggestions:kb:${CHATBOT_ID}`;
    const card = await client.sendCommand(['ZCARD', key]);
    const n = parseInt(card, 10) || 0;
    if (n > 0) {
      ok(`Redis ZCARD ${key} → ${n} KB suggestion(s)`);
    } else {
      console.log(`⚠️  Redis ZCARD ${key} → 0 (KB not seeded for this bot)`);
    }
    await disconnect().catch(() => {});
  } catch (e) {
    console.log(`⚠️  Redis check skipped: ${e.message}`);
  }

  console.log('');
  if (failures === 0) {
    console.log('--- Done: all HTTP checks passed ---');
    process.exit(0);
  }
  console.log(`--- Done: ${failures} failure(s) ---`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
