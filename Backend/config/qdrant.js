const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

// Check if keys are loaded
if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
  console.error("❌ [Qdrant] Missing URL or API Key in .env file");
}

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "user_memories";

// Optional: Test connection immediately
qdrant.getCollections()
  .then((data) => console.log(`✅ [Qdrant] Connected! Found collections: ${data.collections.map(c => c.name).join(', ')}`))
  .catch((err) => console.error(`❌ [Qdrant] Connection Failed: ${err.message}`));

module.exports = {
    qdrant,
    COLLECTION_NAME
};