/**
 * Manually trigger the web crawler for all companies with crawler enabled.
 * Uses the same flow as the scheduled job (DB lookup, Python spawn, embeddings ingest).
 *
 * Usage: node scripts/run-crawler-manual.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { triggerCrawlerManually } = require('../services/crawlerScheduler');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';

async function main() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB\n');

    const result = await triggerCrawlerManually();

    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
    process.exit(result?.success ? 0 : 1);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main();
