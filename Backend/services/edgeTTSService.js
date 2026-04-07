const { EdgeTTS, Constants } = require('@andresaya/edge-tts');
const logger = require('../config/logging');

const EDGE_TTS_TIMEOUT_MS = 8000;

/**
 * NPM EdgeTTS with hard timeout (no WebSocket fallback).
 */
function synthesizeNpm(text, voice) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('EdgeTTS NPM timeout after 8s'));
    }, EDGE_TTS_TIMEOUT_MS);

    (async () => {
      try {
        const tts = new EdgeTTS();
        const synthesizeOptions = {
          outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
        };
        await tts.synthesize(text, voice, synthesizeOptions);
        const audioBuffer = tts.toBuffer();
        clearTimeout(timer);
        if (!audioBuffer) {
          reject(new Error('Empty audio buffer from EdgeTTS'));
          return;
        }
        const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
        if (buffer.length === 0) {
          reject(new Error('Empty audio buffer from EdgeTTS'));
          return;
        }
        resolve(buffer);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    })();
  });
}

async function generateSpeechCore(text, voice) {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 600;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`[EdgeTTS] NPM attempt ${attempt}/${MAX_RETRIES}`);
      const buffer = await synthesizeNpm(text, voice);
      logger.info(`EdgeTTS generated successfully (NPM method): ${buffer.length} bytes`);
      return buffer;
    } catch (err) {
      logger.warn(`[EdgeTTS] NPM attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw new Error('EdgeTTS NPM failed after retries — no WS fallback');
}

/**
 * Generate TTS audio for text using Edge TTS (NPM-only, direct).
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice name (default: 'en-US-JennyNeural')
 * @returns {Promise<Buffer|null>} Audio buffer (MP3) or null if text empty
 */
async function generateSpeech(text, voice = 'en-US-JennyNeural') {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  return generateSpeechCore(trimmed, voice);
}

/**
 * Get available voices
 */
let cachedVoices = null;
async function getVoices() {
  try {
    if (cachedVoices) {
      return cachedVoices;
    }

    cachedVoices = [
      { ShortName: 'en-US-JennyNeural', Gender: 'Female', Locale: 'en-US' },
      { ShortName: 'en-IN-NeerjaNeural', Gender: 'Female', Locale: 'en-IN' },
      { ShortName: 'hi-IN-SwaraNeural', Gender: 'Female', Locale: 'hi-IN' },
      { ShortName: 'en-US-AriaNeural', Gender: 'Female', Locale: 'en-US' },
      { ShortName: 'en-US-GuyNeural', Gender: 'Male', Locale: 'en-US' },
    ];

    return cachedVoices;
  } catch (error) {
    logger.error('Get voices error:', error.message);
    return [];
  }
}

module.exports = {
  generateSpeech,
  getVoices,
};
