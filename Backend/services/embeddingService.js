const openai = require('../config/openai');
const logger = require('../config/logging');
const { extractTextFromQuery } = require('../utils/textExtractor');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

async function generateEmbedding(text) {
  try {
    // Extract text content from multimodal input (handles both strings and Vision API arrays)
    // Embeddings API can ONLY accept text strings, never image objects
    const textToEmbed = extractTextFromQuery(text);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: textToEmbed,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

async function generateEmbeddings(texts) {
  try {
    // Extract text content from each multimodal input in the array
    // Embeddings API can ONLY accept text strings, never image objects
    const textsToEmbed = texts.map(text => extractTextFromQuery(text));

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: textsToEmbed,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    logger.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};

