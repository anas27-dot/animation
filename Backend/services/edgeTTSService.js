const { EdgeTTS, Constants } = require('@andresaya/edge-tts');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logging');

// Voice mapping based on language code
const VOICE_MAP = {
  'en-US': 'en-US-JennyNeural',
  'en': 'en-US-JennyNeural',
  'en-IN': 'en-IN-NeerjaNeural',
  'hi-IN': 'hi-IN-SwaraNeural',
  'hi': 'hi-IN-SwaraNeural',
};

// User-Agent rotation pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

/**
 * Escape XML special characters for SSML
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build SSML with correct voice and language
 */
function buildSSML(text, voice, language) {
  const escapedText = escapeXml(text);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
    <voice name="${voice}">${escapedText}</voice>
  </speak>`;
}

/**
 * Synthesize via WebSocket (fallback method)
 * Returns MP3 buffer
 */
async function synthesizeViaWebSocket(ssml, voiceName, language = 'en-US') {
  return new Promise((resolve, reject) => {
    const trustedClientToken = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
    const connectionId = uuidv4().replace(/-/g, '');
    const requestId = uuidv4().replace(/-/g, '');
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${trustedClientToken}&ConnectionId=${connectionId}`;
    
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    logger.debug('WebSocket connecting to Edge TTS...');
    
    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': userAgent,
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
      }
    });
    
    const audioChunks = [];
    let configSent = false;
    let ssmlSent = false;
    let timeoutId;

    // Set timeout (10 seconds)
    timeoutId = setTimeout(() => {
      logger.warn('WebSocket timeout (10s)');
      ws.close();
      reject(new Error('WebSocket timeout after 10 seconds'));
    }, 10000);

    ws.on('open', () => {
      logger.debug('WebSocket connected');
      
      // Send config message first
      const configMessage = 
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`;
      
      ws.send(configMessage);
      configSent = true;
      
      // Send SSML immediately after config
      setTimeout(() => {
        if (!ssmlSent) {
          const ssmlMessage = 
            `X-RequestId:${requestId}\r\n` +
            `Content-Type:application/ssml+xml\r\n` +
            `Path:ssml\r\n\r\n` +
            ssml;
          
          logger.debug('Sending SSML to WebSocket...');
          ws.send(ssmlMessage);
          ssmlSent = true;
        }
      }, 50);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Binary message - this IS audio data
        const headerEnd = data.indexOf(Buffer.from('\r\n\r\n'));
        
        if (headerEnd !== -1) {
          // Has header - extract audio after header
          const header = data.slice(0, headerEnd).toString('utf-8');
          const audioData = data.slice(headerEnd + 4);
          
          if (header.includes('Path:audio') && audioData.length > 0) {
            audioChunks.push(audioData);
          }
        } else {
          // No header - pure audio data
          if (data.length > 0) {
            audioChunks.push(data);
          }
        }
      } else {
        // Text message
        const message = data.toString('utf-8');
        
        if (message.includes('Path:turn.end')) {
          logger.debug('turn.end received');
          clearTimeout(timeoutId);
          ws.close();
          
          if (audioChunks.length === 0) {
            reject(new Error('No audio chunks received'));
            return;
          }
          
          const audioBuffer = Buffer.concat(audioChunks);
          logger.debug(`WebSocket MP3: ${audioBuffer.length} bytes`);
          resolve(audioBuffer);
        }
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeoutId);
      logger.error('WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeoutId);
      
      // If we have audio, resolve (even if close was unexpected)
      if (audioChunks.length > 0) {
        const audioBuffer = Buffer.concat(audioChunks);
        resolve(audioBuffer);
      } else if (code !== 1000) {
        reject(new Error(`WebSocket closed: ${code} ${reason?.toString() || ''}`));
      }
    });
  });
}

/**
 * Generate TTS audio for text using Edge TTS
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice name (default: 'en-US-JennyNeural')
 * @returns {Promise<Buffer>} Audio buffer (MP3 format)
 */
async function generateSpeech(text, voice = 'en-US-JennyNeural') {
  try {
    if (!text || text.trim().length === 0) {
      return null;
    }

    // Method 1: Try NPM package first
    try {
      logger.debug(`EdgeTTS: Trying NPM package method for: "${text.substring(0, 50)}..."`);
      const tts = new EdgeTTS();
      
      const synthesizeOptions = {
        outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
      };
      
      await tts.synthesize(text, voice, synthesizeOptions);
      const audioBuffer = tts.toBuffer();
      
      if (audioBuffer) {
        const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
        
        if (buffer.length > 0) {
          logger.info(`EdgeTTS generated successfully (NPM method): ${buffer.length} bytes`);
          return buffer;
        }
      }
    } catch (npmError) {
      logger.debug(`NPM package method failed: ${npmError.message}, trying WebSocket...`);
    }

    // Method 2: Fallback to WebSocket method
    logger.debug(`EdgeTTS: Trying WebSocket method for: "${text.substring(0, 50)}..."`);
    const language = voice.startsWith('en-') ? 'en-US' : voice.split('-').slice(0, 2).join('-');
    const ssml = buildSSML(text, voice, language);
    
    const mp3Buffer = await synthesizeViaWebSocket(ssml, voice, language);
    
    if (mp3Buffer && mp3Buffer.length > 0) {
      logger.info(`EdgeTTS generated successfully (WebSocket method): ${mp3Buffer.length} bytes`);
      return mp3Buffer;
    } else {
      throw new Error('Empty audio buffer from EdgeTTS');
    }

  } catch (error) {
    logger.error('EdgeTTS generation error:', error.message);
    throw error;
  }
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

    // Return default voice mapping (fast, no API call needed)
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
