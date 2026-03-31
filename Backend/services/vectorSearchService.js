const embeddingService = require('./embeddingService');
const atlasVectorSearchService = require('./atlasVectorSearchService');
const logger = require('../config/logging');

const SEARCH_MODE = process.env.VECTOR_SEARCH_MODE || 'atlas'; // 'atlas' or 'local'
const MIN_SIMILARITY_SCORE = 0.2; // Lowered from 0.3 to 0.2 to retrieve more relevant results for long chunks
const MAX_RESULTS = 5;

async function search(query, chatbotId, options = {}) {
  try {
    logger.info(`[Vector Search] ===== Starting Vector Search =====`);
    logger.info(`[Vector Search] Query: "${query}"`);
    logger.info(`[Vector Search] ChatbotId: ${chatbotId} (type: ${typeof chatbotId})`);
    logger.info(`[Vector Search] Options:`, JSON.stringify(options));

    // Convert chatbotId to string for logging consistency
    const chatbotIdStr = chatbotId?.toString() || chatbotId;

    // 1. Generate query embedding
    logger.info(`[Vector Search] Step 1: Generating embedding for query...`);
    let queryEmbedding;
    try {
      queryEmbedding = await embeddingService.generateEmbedding(query);
      logger.info(`[Vector Search] ✅ Query embedding generated successfully`);
      logger.info(`[Vector Search] Query embedding length: ${queryEmbedding.length}`);
      logger.info(`[Vector Search] Query embedding preview (first 5 values): [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    } catch (embedError) {
      logger.error(`[Vector Search] ❌ Failed to generate query embedding:`, embedError);
      throw embedError;
    }

    // 2. Perform vector search
    logger.info(`[Vector Search] Step 2: Performing vector search...`);
    const results = await atlasVectorSearchService.searchAtlasVector({
      queryVector: queryEmbedding,
      chatbotId: chatbotIdStr,
      limit: options.limit || MAX_RESULTS,
      minScore: options.minScore || MIN_SIMILARITY_SCORE,
    });

    logger.info(`[Vector Search] ===== Search Complete =====`);
    logger.info(`[Vector Search] Found ${results.length} results for chatbot ${chatbotIdStr}`);
    if (results.length > 0) {
      logger.info(`[Vector Search] Top result scores: ${results.map(r => r.score?.toFixed(3)).join(', ')}`);
      results.forEach((r, index) => {
        logger.info(`[Vector Search] Result ${index + 1}: score=${r.score?.toFixed(3)}, content_preview="${(r.content || '').substring(0, 100)}..."`);
      });
    } else {
      logger.warn(`[Vector Search] ⚠️ No results found - this may indicate:`);
      logger.warn(`[Vector Search]   1. No embeddings exist for this chatbotId`);
      logger.warn(`[Vector Search]   2. All similarity scores are below threshold (${options.minScore || MIN_SIMILARITY_SCORE})`);
      logger.warn(`[Vector Search]   3. Embeddings exist but chatbotId doesn't match`);
    }

    return results;
  } catch (error) {
    logger.error('[Vector Search] ❌ Error:', error);
    logger.error('[Vector Search] Error message:', error.message);
    logger.error('[Vector Search] Error stack:', error.stack);
    return [];
  }
}

module.exports = {
  search,
  MIN_SIMILARITY_SCORE,
  MAX_RESULTS,
};

