/**
 * Optional nightly re-extraction of KB suggestions for all active chatbots.
 * Set ENABLE_KB_SUGGESTION_CRON=true in .env
 */
const cron = require('node-cron');
const Chatbot = require('../models/Chatbot');
const logger = require('../config/logging');
const { extractSuggestionsFromKB } = require('./kbSuggestionExtractor');

function initializeKbSuggestionCron() {
  if (process.env.ENABLE_KB_SUGGESTION_CRON !== 'true') {
    return;
  }
  const schedule = process.env.KB_SUGGESTION_CRON_SCHEDULE || '0 2 * * *';
  cron.schedule(schedule, async () => {
    logger.info('[KB suggestions] Cron: starting nightly extraction');
    try {
      const bots = await Chatbot.find({ isActive: true }).select('_id').lean();
      for (const b of bots) {
        try {
          await extractSuggestionsFromKB(b._id.toString());
        } catch (e) {
          logger.error(`[KB suggestions] Cron failed for ${b._id}:`, e.message);
        }
      }
      logger.info(`[KB suggestions] Cron: finished (${bots.length} bots)`);
    } catch (e) {
      logger.error('[KB suggestions] Cron error:', e.message);
    }
  });
  logger.info(`[KB suggestions] Cron registered: ${schedule}`);
}

module.exports = { initializeKbSuggestionCron };
