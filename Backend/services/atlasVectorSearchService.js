const Embedding = require('../models/Embedding');
const logger = require('../config/logging');

/**
 * MongoDB Atlas Vector Search
 * Requires Atlas Vector Search index to be created
 */
async function searchAtlasVector({
  queryVector,
  chatbotId,
  limit = 5,
  minScore = 0.2, // Lowered from 0.3 to 0.2 to retrieve more relevant results
}) {
  try {
    // Convert chatbotId to ObjectId if it's a string
    const mongoose = require('mongoose');
    const objectIdChatbotId = typeof chatbotId === 'string'
      ? new mongoose.Types.ObjectId(chatbotId)
      : chatbotId;

    // Log debugging info
    logger.info(`[Atlas Vector Search] Searching for chatbotId: ${chatbotId} (converted: ${objectIdChatbotId})`);

    // Check if embeddings exist for this chatbot
    const totalCount = await Embedding.countDocuments({ chatbotId: objectIdChatbotId });
    logger.info(`[Atlas Vector Search] Total embeddings in DB for this chatbot: ${totalCount}`);

    // MongoDB Atlas Vector Search aggregation pipeline
    const pipeline = [
      {
        $vectorSearch: {
          index: 'embedding_vector_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 100,
          limit: limit * 2, // Get more results to filter
          filter: {
            chatbotId: objectIdChatbotId,
          },
        },
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: {
          score: { $gte: minScore },
        },
      },
      {
        $limit: limit,
      },
    ];

    const results = await Embedding.aggregate(pipeline);

    return results.map((r) => ({
      content: r.content,
      score: r.score,
      metadata: r.metadata,
    }));
  } catch (error) {
    logger.error('Atlas Vector Search error:', error);

    // Fallback to local cosine similarity
    logger.warn('Falling back to local cosine similarity');
    return searchLocalCosine(queryVector, chatbotId, limit, minScore);
  }
}

/**
 * Local cosine similarity fallback
 */
async function searchLocalCosine(queryVector, chatbotId, limit = 5, minScore = 0.2) {
  try {
    // Convert chatbotId to ObjectId if it's a string
    const mongoose = require('mongoose');
    const objectIdChatbotId = typeof chatbotId === 'string'
      ? new mongoose.Types.ObjectId(chatbotId)
      : chatbotId;

    // Log debugging info
    logger.info(`[Local Cosine Search] Searching for chatbotId: ${chatbotId} (converted: ${objectIdChatbotId})`);
    logger.info(`[Local Cosine Search] Query vector length: ${queryVector.length}`);

    // Check total documents in collection
    const totalDocsInCollection = await Embedding.countDocuments({});
    logger.info(`[Local Cosine Search] Total docs in collection: ${totalDocsInCollection}`);

    // Try with ObjectId first
    let embeddings = await Embedding.find({ chatbotId: objectIdChatbotId }).lean();
    logger.info(`[Local Cosine Search] Found ${embeddings.length} documents with ObjectId filter`);

    // If no results, try with string version (backward compatibility)
    if (embeddings.length === 0) {
      logger.warn(`[Local Cosine Search] No results with ObjectId, trying string version`);
      embeddings = await Embedding.find({ chatbotId: chatbotId.toString() }).lean();
      logger.info(`[Local Cosine Search] Found ${embeddings.length} documents with string filter`);
    }

    // Log total count for debugging
    const totalCount = await Embedding.countDocuments({ chatbotId: objectIdChatbotId });
    logger.info(`[Local Cosine Search] Total embeddings count: ${totalCount}`);

    // Sample document check
    if (totalCount > 0) {
      const sampleDoc = await Embedding.findOne({ chatbotId: objectIdChatbotId }).lean();
      if (sampleDoc) {
        logger.info(`[Local Cosine Search] Sample doc ID: ${sampleDoc._id}`);
        logger.info(`[Local Cosine Search] Sample doc chatbotId: ${sampleDoc.chatbotId}`);
        logger.info(`[Local Cosine Search] Sample doc chatbotId type: ${typeof sampleDoc.chatbotId}`);
        logger.info(`[Local Cosine Search] Sample doc content length: ${sampleDoc.content?.length || 0}`);
        logger.info(`[Local Cosine Search] Sample doc embedding length: ${sampleDoc.embedding?.length || 0}`);
        logger.info(`[Local Cosine Search] Sample doc metadata:`, JSON.stringify(sampleDoc.metadata || {}));
        logger.info(`[Local Cosine Search] Sample doc content preview (first 200 chars): ${(sampleDoc.content || '').substring(0, 200)}`);
      }
    }

    if (embeddings.length === 0) {
      logger.warn(`[Local Cosine Search] No embeddings found for chatbotId: ${chatbotId}`);
      // Also check if any embeddings exist at all
      logger.info(`[Local Cosine Search] Total embeddings in database: ${totalDocsInCollection}`);

      // Show what chatbotIds actually exist in the database
      const distinctChatbotIds = await Embedding.distinct('chatbotId');
      logger.info(`[Local Cosine Search] Distinct chatbotIds in database: ${distinctChatbotIds.length}`);
      if (distinctChatbotIds.length > 0) {
        logger.info(`[Local Cosine Search] Sample chatbotIds: ${distinctChatbotIds.slice(0, 3).map(id => id.toString()).join(', ')}`);
      }
      return [];
    }

    // Calculate cosine similarity
    logger.info(`[Local Cosine Search] Calculating similarity for ${embeddings.length} embeddings`);
    const resultsWithScores = embeddings
      .map((embedding, index) => {
        // Check if embedding has valid embedding vector
        if (!embedding.embedding || !Array.isArray(embedding.embedding) || embedding.embedding.length === 0) {
          logger.warn(`[Local Cosine Search] Embedding ${index} has invalid embedding vector`);
          return null;
        }

        const score = cosineSimilarity(queryVector, embedding.embedding);
        return {
          content: embedding.content,
          score,
          metadata: embedding.metadata,
          embeddingLength: embedding.embedding.length,
        };
      })
      .filter((r) => r !== null); // Remove null entries

    logger.info(`[Local Cosine Search] Calculated ${resultsWithScores.length} valid similarities`);
    if (resultsWithScores.length > 0) {
      const scores = resultsWithScores.map(r => r.score).sort((a, b) => b - a);
      logger.info(`[Local Cosine Search] Score range: min=${Math.min(...scores).toFixed(3)}, max=${Math.max(...scores).toFixed(3)}, median=${scores[Math.floor(scores.length / 2)].toFixed(3)}`);
    }

    const results = resultsWithScores
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    logger.info(`[Local Cosine Search] Returning ${results.length} results after filtering (minScore: ${minScore})`);

    return results;
  } catch (error) {
    logger.error('Local cosine search error:', error);
    return [];
  }
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

module.exports = {
  searchAtlasVector,
  searchLocalCosine,
};

