const suggestionService = require('../services/suggestionService');
const { extractSuggestionsFromKB } = require('../services/kbSuggestionExtractor');

const ALLOWED_CONTEXT = new Set(['billing', 'support', 'onboarding']);

function getSuggestions(req, res) {
  const prefix = req.query.prefix || req.query.q || '';
  const chatbotId = req.query.chatbotId || req.query.botId;
  const userId = req.query.userId || '';
  const rawTopic = req.query.topic || req.query.context;
  const context = rawTopic;

  if (!chatbotId) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'chatbotId is required' });
  }

  const ctx =
    context && ALLOWED_CONTEXT.has(String(context).toLowerCase())
      ? String(context).toLowerCase()
      : undefined;

  suggestionService
    .getSuggestions(chatbotId, userId, prefix, ctx)
    .then((suggestions) => res.json({ suggestions }))
    .catch((err) => {
      res.status(500).json({ error: 'SUGGESTIONS_ERROR', message: err.message });
    });
}

function recordQuery(req, res) {
  const { query, chatbotId, userId } = req.body || {};

  if (!chatbotId || typeof query !== 'string') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'chatbotId and query are required' });
  }

  suggestionService
    .recordQuery(chatbotId, userId, query)
    .then((result) => res.status(200).json(result))
    .catch((err) => {
      res.status(500).json({ error: 'SUGGESTIONS_RECORD_ERROR', message: err.message });
    });
}

function reseedKbSuggestions(req, res) {
  const { chatbotId } = req.params;
  const key = req.headers['x-admin-key'] || req.query.key;
  const secret = process.env.SUGGESTION_RESEED_KEY;
  if (secret && key !== secret) {
    return res.status(403).json({ error: 'Forbidden', message: 'Invalid or missing X-Admin-Key' });
  }
  if (!secret && process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Not configured',
      message: 'Set SUGGESTION_RESEED_KEY in production to enable manual KB re-seed',
    });
  }

  extractSuggestionsFromKB(chatbotId)
    .then((questions) => res.json({ success: true, count: questions.length, questions }))
    .catch((err) => res.status(500).json({ error: 'KB_SUGGESTION_EXTRACT_FAILED', message: err.message }));
}

module.exports = {
  getSuggestions,
  recordQuery,
  reseedKbSuggestions,
};
