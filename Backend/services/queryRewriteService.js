const logger = require('../config/logging');
const { extractTextFromQuery } = require('../utils/textExtractor');

// Common abbreviations mapping
const ABBREVIATIONS = {
  'u': 'you',
  'ur': 'your',
  'r': 'are',
  'pls': 'please',
  'thx': 'thanks',
  'ty': 'thank you',
  'np': 'no problem',
  'lol': 'laugh out loud',
  'btw': 'by the way',
  'fyi': 'for your information',
};

async function rewriteQuery(query, context = {}) {
  try {
    // Extract text content from multimodal input (handles both strings and Vision API arrays)
    const textToProcess = extractTextFromQuery(query);
    let rewritten = textToProcess.trim();

    // 1. Expand common abbreviations
    rewritten = expandAbbreviations(rewritten);

    // 2. Basic spelling correction (simple implementation)
    // In production, use a library like nspell or similar

    // 3. Add context from conversation history if available
    if (context.history && context.history.length > 0) {
      rewritten = addContext(rewritten, context.history);
    }

    // 4. Remove excessive punctuation
    rewritten = rewritten.replace(/[!]{2,}/g, '!');
    rewritten = rewritten.replace(/[?]{2,}/g, '?');

    return rewritten;
  } catch (error) {
    logger.error('Query rewrite error:', error);
    return query; // Return original on error
  }
}

function expandAbbreviations(text) {
  let expanded = text;
  const words = text.split(/\s+/);

  words.forEach((word) => {
    const lowerWord = word.toLowerCase().replace(/[.,!?;:]$/, '');
    if (ABBREVIATIONS[lowerWord]) {
      const punctuation = word.match(/[.,!?;:]$/)?.[0] || '';
      expanded = expanded.replace(
        new RegExp(`\\b${word}\\b`, 'gi'),
        ABBREVIATIONS[lowerWord] + punctuation
      );
    }
  });

  return expanded;
}

function addContext(query, history) {
  // Simple context addition - take last user message context
  // In production, use more sophisticated context extraction
  const lastMessages = history.slice(-2).map((m) => m.content).join(' ');
  
  // Only add context if query is very short
  if (query.length < 20 && lastMessages) {
    return `${query} (context: ${lastMessages.substring(0, 100)})`;
  }

  return query;
}

module.exports = {
  rewriteQuery,
};

