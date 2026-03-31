/**
 * Migration script to drop old unique index on company+date
 * and ensure new index on chatbotId+date exists
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DailySummary = require('../models/DailySummary');

async function migrateIndexes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const collection = DailySummary.collection;

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => ({ name: idx.name, unique: idx.unique, key: idx.key })));

    // Drop old unique index on company+date if it exists
    try {
      const oldIndexExists = indexes.some(idx => 
        idx.name === 'company_1_date_1' && idx.unique === true
      );
      
      if (oldIndexExists) {
        await collection.dropIndex('company_1_date_1');
        console.log('✅ Dropped old unique index: company_1_date_1');
      } else {
        console.log('ℹ️  Old index company_1_date_1 not found (may have been dropped already)');
      }
    } catch (error) {
      if (error.code === 27) { // IndexNotFound
        console.log('ℹ️  Index company_1_date_1 does not exist');
      } else {
        throw error;
      }
    }

    // Ensure new index on chatbotId+date exists
    try {
      const newIndexExists = indexes.some(idx => 
        idx.name === 'chatbotId_1_date_1' && idx.unique === true
      );
      
      if (!newIndexExists) {
        await collection.createIndex({ chatbotId: 1, date: 1 }, { unique: true, name: 'chatbotId_1_date_1' });
        console.log('✅ Created new unique index: chatbotId_1_date_1');
      } else {
        console.log('ℹ️  New index chatbotId_1_date_1 already exists');
      }
    } catch (error) {
      console.error('❌ Error creating new index:', error.message);
    }

    // Verify final indexes
    const finalIndexes = await collection.indexes();
    console.log('\n📋 Final indexes:', finalIndexes.map(idx => ({ name: idx.name, unique: idx.unique, key: idx.key })));

    console.log('\n✅ Migration completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateIndexes();
