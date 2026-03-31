/**
 * Text Chunking Utility
 * Splits large text into smaller chunks for embedding generation
 * 
 * Embedding model limit: 8192 tokens
 * Rough estimate: 1 token ≈ 4 characters
 * Safe chunk size: ~6000 characters (~1500 tokens per chunk)
 */

const CHUNK_SIZE = 6000; // characters
const CHUNK_OVERLAP = 200; // characters for context overlap

/**
 * Split text into chunks
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Maximum size of each chunk (default: 6000)
 * @param {number} overlap - Overlap between chunks (default: 200)
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || text.length === 0) {
    return [];
  }

  // If text is smaller than chunk size, return as single chunk
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    // If this is not the last chunk, try to break at a sentence or paragraph boundary
    if (endIndex < text.length) {
      // Try to find a good breaking point (sentence end, paragraph break, etc.)
      const chunk = text.substring(startIndex, endIndex);
      
      // Look for sentence endings (. ! ?) near the end
      const sentenceEndMatch = chunk.match(/[.!?]\s+(?=[A-Z])/g);
      if (sentenceEndMatch && sentenceEndMatch.length > 0) {
        const lastSentenceEnd = chunk.lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
        if (lastSentenceEnd > chunk.length - 500) { // Within last 500 chars
          endIndex = startIndex + lastSentenceEnd + 1;
        }
      } else {
        // Look for paragraph breaks (\n\n)
        const paragraphBreak = chunk.lastIndexOf('\n\n');
        if (paragraphBreak > chunk.length - 500) {
          endIndex = startIndex + paragraphBreak + 2;
        } else {
          // Look for single line breaks
          const lineBreak = chunk.lastIndexOf('\n');
          if (lineBreak > chunk.length - 500) {
            endIndex = startIndex + lineBreak + 1;
          }
        }
      }
    }

    chunks.push(text.substring(startIndex, endIndex).trim());

    // Move start index forward, accounting for overlap
    startIndex = endIndex - overlap;
    if (startIndex < 0) startIndex = 0;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

module.exports = {
  chunkText,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
};
