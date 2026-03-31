const SSEHelper = require('../utils/sseHelper');
const sentenceDetector = require('../utils/sentenceDetector');
const edgeTTSService = require('./edgeTTSService');
const logger = require('../config/logging');

async function streamResponse(config) {
  const { responseGenerator, res, options = {} } = config;
  const { enableTTS = false, voice = 'en-US-JennyNeural' } = options;

  logger.info('🎬 [StreamingService] streamResponse called');

  // Setup SSE headers
  SSEHelper.setupSSEHeaders(res);

  try {
    // Send initial status
    SSEHelper.sendStatus(res, 'Processing your request...');

    let fullText = '';
    let wordCount = 0;
    const startTime = Date.now();
    let lastSentence = '';
    let sentenceBuffer = '';
    let audioSequence = 0;

    // Stream response chunks
    logger.info('🔄 [StreamingService] About to call responseGenerator() and start consuming');
    let eventCount = 0;
    for await (const event of responseGenerator()) {
      eventCount++;
      logger.info(`📥 [StreamingService] Event #${eventCount} received:`, event.type);
      if (event.type === 'text') {
        fullText += event.data;
        wordCount += event.data.split(/\s+/).length;
        sentenceBuffer += event.data;

        // Send text chunk immediately
        SSEHelper.sendTextChunk(res, event.data);

        // Check for complete sentences (for TTS if enabled)
        if (enableTTS) {
          const currentSentence = sentenceDetector.getLastSentence(sentenceBuffer);

          // If we have a complete sentence that's different from last one
          if (currentSentence !== lastSentence &&
            currentSentence.length > 0 &&
            sentenceDetector.isSentenceComplete(currentSentence)) {

            // Generate TTS for completed sentence (non-blocking)
            (async () => {
              try {
                const audioBuffer = await edgeTTSService.generateSpeech(currentSentence, voice);
                if (audioBuffer) {
                  const base64Audio = audioBuffer.toString('base64');
                  SSEHelper.sendAudioChunk(res, base64Audio, audioSequence++);
                }
              } catch (ttsError) {
                logger.error('TTS generation error:', ttsError);
                // Continue without audio on error
              }
            })();

            lastSentence = currentSentence;
            // Keep buffer but mark this sentence as processed
            sentenceBuffer = sentenceBuffer.replace(currentSentence, '').trim();
          }
        }
      } else if (event.type === 'metadata') {
        SSEHelper.sendMetadata(res, event.data);
      } else if (event.type === 'proposal_intent_detected') {
        // Send proposal intent detected event to frontend
        logger.info('📤 [SSE] Sending proposal_intent_detected event to frontend');
        logger.info('📤 [SSE] Event data:', JSON.stringify(event.data, null, 2));
        SSEHelper.sendProposalIntentDetected(res, event.data);
        // Don't break - continue to allow complete event if it comes
      } else if (event.type === 'email_intent_detected') {
        // Send email intent detected event to frontend
        logger.info('📤 [SSE] Sending email_intent_detected event to frontend');
        logger.info('📤 [SSE] Event data:', JSON.stringify(event.data, null, 2));
        SSEHelper.sendEmailIntentDetected(res, event.data);
        // Don't break - continue to allow complete event if it comes
      } else if (event.type === 'calling_intent_detected') {
        // Send calling intent detected event to frontend
        logger.info('📤 [SSE] Sending calling_intent_detected event to frontend');
        logger.info('📤 [SSE] Event data:', JSON.stringify(event.data, null, 2));
        SSEHelper.sendCallingIntentDetected(res, event.data);
        // Don't break - continue to allow complete event if it comes
      } else if (event.type === 'error') {
        SSEHelper.sendError(res, event.error);
        break;
      } else if (event.type === 'complete') {
        // Generate TTS for any remaining text
        if (enableTTS && sentenceBuffer.trim()) {
          (async () => {
            try {
              const audioBuffer = await edgeTTSService.generateSpeech(sentenceBuffer.trim(), voice);
              if (audioBuffer) {
                const base64Audio = audioBuffer.toString('base64');
                SSEHelper.sendAudioChunk(res, base64Audio, audioSequence++);
              }
            } catch (ttsError) {
              logger.error('Final TTS error:', ttsError);
            }
          })();
        }

        const duration = Date.now() - startTime;
        SSEHelper.sendComplete(res, {
          duration,
          wordCount,
          tokens: event.tokens,
        });
        return;
      }
    }

    // If we exit the loop without complete event, send completion
    // Generate TTS for any remaining text
    if (enableTTS && sentenceBuffer.trim()) {
      (async () => {
        try {
          const audioBuffer = await edgeTTSService.generateSpeech(sentenceBuffer.trim(), voice);
          if (audioBuffer) {
            const base64Audio = audioBuffer.toString('base64');
            SSEHelper.sendAudioChunk(res, base64Audio, audioSequence++);
          }
        } catch (ttsError) {
          logger.error('Final TTS error:', ttsError);
        }
      })();
    }

    const duration = Date.now() - startTime;
    SSEHelper.sendComplete(res, {
      duration,
      wordCount,
    });
  } catch (error) {
    logger.error('Streaming response error:', error);
    SSEHelper.sendError(res, error.message);
  }
}

module.exports = {
  streamResponse,
};

