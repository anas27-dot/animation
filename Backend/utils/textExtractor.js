/**
 * Utility function to extract text content from multimodal input (Vision API)
 * Handles both string input and Vision API array format
 *
 * @param {string|Array} input - Either a string or Vision API content array
 * @returns {string} - Extracted text content
 */
function extractTextFromQuery(input) {
  // If input is already a string, return it as-is
  if (typeof input === 'string') {
    return input;
  }

  // If input is an array (Vision API format), extract text content
  if (Array.isArray(input)) {
    // Find the text item in the Vision API array
    const textItem = input.find(item => item.type === 'text');
    return textItem ? textItem.text : '';
  }

  // Fallback for unexpected input types
  return String(input || '');
}

module.exports = {
  extractTextFromQuery
};