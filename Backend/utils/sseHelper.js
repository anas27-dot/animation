/**
 * Server-Sent Events (SSE) Helper Utilities
 * Compatible with Nova Enterprise UI sseParser.js
 */

/**
 * Setup SSE headers on response
 */
function setupSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/**
 * Send generic SSE event
 */
function sendEvent(res, eventType, data) {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${dataString}\n\n`);
  } catch (error) {
    console.error('SSE sendEvent error:', error);
  }
}

/**
 * Send status update
 */
function sendStatus(res, message) {
  sendEvent(res, 'status', { message });
}

/**
 * Send text chunk - UI expects 'text' event with { content: string }
 */
function sendTextChunk(res, content) {
  sendEvent(res, 'text', { content });
}

/**
 * Send audio chunk - UI expects { chunk: base64, sequence: number }
 */
function sendAudioChunk(res, chunk, sequence = 0) {
  sendEvent(res, 'audio', { chunk, sequence });
}

/**
 * Send metadata (Calendly, product cards, etc.)
 */
function sendMetadata(res, metadata) {
  sendEvent(res, 'metadata', metadata);
}

/**
 * Send suggestions - UI expects { suggestions: string[] }
 */
function sendSuggestions(res, suggestions) {
  sendEvent(res, 'suggestions', { suggestions });
}

/**
 * Send warning message
 */
function sendWarning(res, message) {
  sendEvent(res, 'warning', { message });
}

/**
 * Send error - UI expects { error: code, message: string }
 */
function sendError(res, message, code = 'ERROR') {
  sendEvent(res, 'error', { error: code, message });
}

/**
 * Send completion - UI expects 'done' event
 */
function sendComplete(res, data = {}) {
  sendEvent(res, 'done', data);
}

/**
 * Send connected event
 */
function sendConnected(res, data) {
  sendEvent(res, 'connected', data);
}

/**
 * Send message event (generic)
 */
function sendMessage(res, data) {
  sendEvent(res, 'message', data);
}

/**
 * Send proposal intent detected event
 */
function sendProposalIntentDetected(res, data) {
  sendEvent(res, 'proposal_intent_detected', data);
}

/**
 * Send email intent detected event
 */
function sendEmailIntentDetected(res, data) {
  sendEvent(res, 'email_intent_detected', data);
}

/**
 * Send calling intent detected event
 */
function sendCallingIntentDetected(res, data) {
  sendEvent(res, 'calling_intent_detected', data);
}

/**
 * Keep-alive ping
 */
function sendPing(res) {
  try {
    res.write(': ping\n\n');
  } catch (error) {
    // Connection closed
  }
}

module.exports = {
  setupSSEHeaders,
  sendEvent,
  sendStatus,
  sendTextChunk,
  sendAudioChunk,
  sendMetadata,
  sendSuggestions,
  sendWarning,
  sendError,
  sendComplete,
  sendConnected,
  sendMessage,
  sendPing,
  sendProposalIntentDetected,
  sendEmailIntentDetected,
  sendCallingIntentDetected,
};
