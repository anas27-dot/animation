/**
 * Sentence boundary detection for TTS streaming
 */

const SENTENCE_ENDINGS = /[.!?]\s+/g;

function detectSentences(text) {
  const sentences = text.split(SENTENCE_ENDINGS).filter((s) => s.trim().length > 0);
  return sentences.map((s) => s.trim());
}

function isSentenceComplete(text) {
  return /[.!?]\s*$/.test(text);
}

function getLastSentence(text) {
  const sentences = detectSentences(text);
  return sentences[sentences.length - 1] || '';
}

module.exports = {
  detectSentences,
  isSentenceComplete,
  getLastSentence,
};

