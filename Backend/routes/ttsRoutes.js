const express = require('express');
const logger = require('../config/logging');
const edgeTTSService = require('../services/edgeTTSService');

const router = express.Router();

const MAX_CHARS = 500;

/**
 * POST /api/tts/edge
 * Body: { text: string, voice?: string, chatbotId?: string }
 * chatbotId optional; helps dynamic CORS on some origins. Returns audio/mpeg.
 */
router.post('/edge', async (req, res) => {
  try {
    const raw = typeof req.body?.text === 'string' ? req.body.text : '';
    const text = raw.trim();
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ error: `text must be at most ${MAX_CHARS} characters` });
    }

    const voice =
      typeof req.body?.voice === 'string' && req.body.voice.trim()
        ? req.body.voice.trim()
        : 'en-US-JennyNeural';

    const buffer = await edgeTTSService.generateSpeech(text, voice);
    if (!buffer || buffer.length === 0) {
      return res.status(502).json({ error: 'TTS produced no audio' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (err) {
    logger.error('[TTS /edge error]', err.message);
    return res.status(503).json({ error: 'TTS unavailable', detail: err.message, retry: true });
  }
});

module.exports = router;
