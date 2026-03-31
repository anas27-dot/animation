#!/usr/bin/env node
/**
 * Calls suggestionService.getSuggestions() for several prefixes (Redis only; no HTTP).
 * Verifies that with SUGGESTION_DISCOVERY_ENABLED unset/false, "tell me" / "tell me about"
 * do not return unrelated KB filler when nothing matches.
 *
 * Usage:
 *   node scripts/test-suggestion-prefixes.js <chatbotId>
 *   npm run test:suggestion-prefixes -- <chatbotId>
 */

require('dotenv').config();

const suggestionService = require('../services/suggestionService');

const chatbotId = process.argv[2] || process.env.TEST_CHATBOT_ID;

const PREFIXES = ['tell me', 'tell me about', 'what is', 'how do', 'swara'];

async function main() {
  if (!chatbotId) {
    console.error('Usage: node scripts/test-suggestion-prefixes.js <chatbotId>');
    process.exit(1);
  }

  console.log('--- Prefix behavior (direct suggestionService) ---\n');
  console.log('CHATBOT_ID:', chatbotId);
  console.log(
    'SUGGESTION_DISCOVERY_ENABLED:',
    process.env.SUGGESTION_DISCOVERY_ENABLED === 'true' ? 'true' : 'false (default)'
  );
  console.log('');

  for (const prefix of PREFIXES) {
    const list = await suggestionService.getSuggestions(
      chatbotId,
      'test_user_prefix_script',
      prefix,
      undefined
    );
    console.log(`[${JSON.stringify(prefix)}] → ${list.length} suggestion(s)`);
    list.slice(0, 6).forEach((s, i) => console.log(`  ${i + 1}. ${String(s).slice(0, 120)}`));
    if (list.length > 6) console.log(`  … +${list.length - 6} more`);
    console.log('');
  }

  const tellMe = await suggestionService.getSuggestions(
    chatbotId,
    'u',
    'tell me',
    undefined
  );
  const tellMeAbout = await suggestionService.getSuggestions(
    chatbotId,
    'u',
    'tell me about',
    undefined
  );

  if (process.env.SUGGESTION_DISCOVERY_ENABLED === 'true') {
    console.log('ℹ️  Discovery is ON — generic KB fill may appear when prefix does not match.');
  } else {
    console.log('--- Check (discovery off) ---');
    console.log(`"tell me" → ${tellMe.length}, "tell me about" → ${tellMeAbout.length}`);
    if (tellMe.length === 0 && tellMeAbout.length === 0) {
      console.log(
        '✅ OK: no unrelated KB dump for these stubs (empty unless a stored line contains the substring).'
      );
    } else {
      console.log(
        'ℹ️  Non-zero counts mean at least one KB/popular/personal line matched (substring includes).'
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
