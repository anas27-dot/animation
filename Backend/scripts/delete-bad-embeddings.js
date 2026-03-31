/**
 * Script to delete embeddings with binary/invalid content
 * Usage: node backend/scripts/delete-bad-embeddings.js <chatbotId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Embedding = require('../models/Embedding');

const chatbotId = process.argv[2] || '6954ae35bee8b7bf0842c1d9';

async function deleteBadEmbeddings() {
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
    console.log(`🔍 Checking embeddings for chatbotId: ${chatbotId}\n`);

    // Find all embeddings for this chatbot
    const embeddings = await Embedding.find({ chatbotId: objectIdChatbotId }).lean();
    console.log(`📊 Total embeddings found: ${embeddings.length}\n`);

    // Check for binary content (common indicators)
    const badEmbeddings = [];
    embeddings.forEach((emb, index) => {
      const content = emb.content || '';
      // Check for binary indicators
      const hasBinarySignature = content.startsWith('PK') || // ZIP/DOCX
                                  content.includes('\x00') || // Null bytes
                                  /[\x00-\x08\x0E-\x1F]{5,}/.test(content.substring(0, 100)); // Multiple control chars
      
      // Check if content is mostly non-printable or very short
      const printableRatio = (content.match(/[\x20-\x7E\n\r\t]/g) || []).length / Math.max(content.length, 1);
      const isBad = hasBinarySignature || printableRatio < 0.5 || content.length < 20;
      
      if (isBad) {
        badEmbeddings.push({
          _id: emb._id,
          preview: content.substring(0, 50),
          length: content.length,
          reason: hasBinarySignature ? 'Binary signature detected' : 
                  printableRatio < 0.5 ? 'Low printable character ratio' : 
                  'Too short'
        });
      }
    });

    if (badEmbeddings.length === 0) {
      console.log('✅ No bad embeddings found!');
    } else {
      console.log(`⚠️  Found ${badEmbeddings.length} bad embeddings:\n`);
      badEmbeddings.forEach((bad, index) => {
        console.log(`   ${index + 1}. ID: ${bad._id}`);
        console.log(`      Reason: ${bad.reason}`);
        console.log(`      Length: ${bad.length}`);
        console.log(`      Preview: ${bad.preview.replace(/[^\x20-\x7E\n\r\t]/g, '.')}\n`);
      });

      // Ask for confirmation (in real use, you'd want to add readline)
      console.log(`🗑️  Deleting ${badEmbeddings.length} bad embeddings...`);
      const idsToDelete = badEmbeddings.map(b => b._id);
      const result = await Embedding.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`✅ Deleted ${result.deletedCount} embeddings\n`);
    }

    // Show remaining embeddings
    const remaining = await Embedding.countDocuments({ chatbotId: objectIdChatbotId });
    console.log(`📊 Remaining embeddings: ${remaining}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteBadEmbeddings();

