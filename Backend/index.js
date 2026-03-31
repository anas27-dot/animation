require('dotenv').config();
const app = require('./app');
const db = require('./db');
const { initializeDailySummaryScheduler } = require('./services/dailySummaryScheduler');
const { initializeCrawlerScheduler } = require('./services/crawlerScheduler');
const { initializeKbSuggestionCron } = require('./services/kbSuggestionScheduler');
const DailySummary = require('./models/DailySummary');

const PORT = process.env.PORT || 5000;

// Migrate DailySummary indexes on startup
async function migrateDailySummaryIndexes() {
  try {
    const collection = DailySummary.collection;
    const indexes = await collection.indexes();

    // Drop old unique index on company+date if it exists
    const oldIndexExists = indexes.some(idx =>
      idx.name === 'company_1_date_1' && idx.unique === true
    );

    if (oldIndexExists) {
      await collection.dropIndex('company_1_date_1');
      console.log('✅ Dropped old unique index: company_1_date_1');
    }

    // Clean up old records with null chatbotId (from previous schema)
    const deletedCount = await DailySummary.deleteMany({ chatbotId: null });
    if (deletedCount.deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount.deletedCount} old summary record(s) with null chatbotId`);
    }

    // Ensure new index exists (drop and recreate if it has null values)
    const newIndexExists = indexes.some(idx =>
      idx.name === 'chatbotId_1_date_1' && idx.unique === true
    );

    if (newIndexExists) {
      // Try to drop and recreate to handle any null values
      try {
        await collection.dropIndex('chatbotId_1_date_1');
      } catch (e) {
        // Index might not exist or already dropped
      }
    }

    // Create the index (will fail if there are still duplicates, but that's okay)
    try {
      await collection.createIndex({ chatbotId: 1, date: 1 }, { unique: true, sparse: false });
      console.log('✅ Created new unique index: chatbotId_1_date_1');
    } catch (error) {
      if (error.code === 85) { // IndexOptionsConflict
        console.log('ℹ️  Index already exists with different options');
      } else if (error.code === 11000) { // DuplicateKey
        console.log('⚠️  Index creation skipped due to duplicate keys - will be created on next cleanup');
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error.code === 27) { // IndexNotFound - ignore
      console.log('ℹ️  Index migration: Index not found (already migrated or never existed)');
    } else {
      console.warn('⚠️  Index migration warning:', error.message);
    }
  }
}

// Start server after DB connection
db.connect()
  .then(async () => {
    // Migrate indexes before starting server
    await migrateDailySummaryIndexes();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

      // Initialize daily summary scheduler
      initializeDailySummaryScheduler();

      // Initialize crawler scheduler
      initializeCrawlerScheduler();

      initializeKbSuggestionCron();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `❌ Port ${PORT} is already in use. Stop the other process or set PORT in .env to a free port (e.g. 5001).`
        );
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

