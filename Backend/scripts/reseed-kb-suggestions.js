#!/usr/bin/env node
/**
 * One-shot KB suggestion extraction into Redis (calls existing POST route).
 *
 *   node scripts/reseed-kb-suggestions.js <chatbotId>
 *   npm run reseed:kb -- <chatbotId>
 *
 * Env: SUGGESTION_RESEED_KEY (required in production for X-Admin-Key)
 *      TEST_API_BASE (default http://localhost:5000/api)
 */
require('dotenv').config();

const chatbotId = process.argv[2] || process.env.TEST_CHATBOT_ID;
const base = (process.env.TEST_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const secret = process.env.SUGGESTION_RESEED_KEY;

if (!chatbotId) {
  console.error('Usage: node scripts/reseed-kb-suggestions.js <chatbotId>');
  process.exit(1);
}

async function main() {
  const url = `${base}/chat/suggestions/reseed-kb/${chatbotId}`;
  const headers = {};
  if (secret) headers['X-Admin-Key'] = secret;

  const res = await fetch(url, { method: 'POST', headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.error('Failed:', res.status, data);
    process.exit(1);
  }
  console.log('OK:', data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
