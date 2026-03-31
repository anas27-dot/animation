/**
 * Script to check embeddings in database for a specific chatbot
 * Usage: node backend/scripts/check-embeddings.js <chatbotId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Embedding = require('../models/Embedding');

const chatbotId = process.argv[2] || '6954ae35bee8b7bf0842c1d9';

async function checkEmbeddings() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Convert chatbotId to ObjectId
    const objectIdChatbotId = new mongoose.Types.ObjectId(chatbotId);
    console.log(`🔍 Checking embeddings for chatbotId: ${chatbotId}`);
    console.log(`   (ObjectId: ${objectIdChatbotId})\n`);

    // Count total embeddings for this chatbot
    const count = await Embedding.countDocuments({ chatbotId: objectIdChatbotId });
    console.log(`📊 Total embeddings found: ${count}`);

    if (count === 0) {
      console.log('\n⚠️  No embeddings found!');
      
      // Check if chatbotId as string exists
      const countString = await Embedding.countDocuments({ chatbotId: chatbotId });
      console.log(`   (Trying as string: ${countString})`);
      
      // Check total embeddings in database
      const totalCount = await Embedding.countDocuments({});
      console.log(`\n📊 Total embeddings in database: ${totalCount}`);
      
      if (totalCount > 0) {
        // Show sample of chatbotIds that exist
        const samples = await Embedding.aggregate([
          { $group: { _id: '$chatbotId', count: { $sum: 1 } } },
          { $limit: 5 }
        ]);
        console.log('\n📋 Sample chatbotIds in database:');
        samples.forEach(s => {
          console.log(`   - ${s._id} (${s.count} embeddings)`);
        });
      }
    } else {
      // Show sample embeddings
      const samples = await Embedding.find({ chatbotId: objectIdChatbotId })
        .limit(3)
        .select('content metadata embedding')
        .lean();
      
      console.log(`\n📄 Sample embeddings (first 3):`);
      samples.forEach((emb, index) => {
        console.log(`\n   ${index + 1}. Metadata:`, emb.metadata);
        console.log(`      Content preview: ${emb.content.substring(0, 100)}...`);
        console.log(`      Embedding length: ${emb.embedding?.length || 0}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEmbeddings();

