require('dotenv').config();
const mongoose = require('mongoose');
const Chatbot = require('../models/Chatbot');
const Company = require('../models/Company');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Embedding = require('../models/Embedding');
const UserSession = require('../models/UserSession');
const LeadCapture = require('../models/LeadCapture');
const User = require('../models/User');
const UserCreditTransaction = require('../models/UserCreditTransaction');
const VerifiedUser = require('../models/VerifiedUser');
const PhoneUser = require('../models/PhoneUser');

async function cleanupOrphanedData() {
  try {
    console.log('🔍 Starting orphaned data cleanup...');

    // Get all existing chatbot IDs
    const existingChatbotIds = await Chatbot.distinct('_id');
    console.log(`📊 Found ${existingChatbotIds.length} active chatbots`);

    // Get all existing company IDs
    const existingCompanyIds = await Company.distinct('_id');
    console.log(`📊 Found ${existingCompanyIds.length} active companies`);

    let totalDeleted = {
      chats: 0,
      messages: 0,
      embeddings: 0,
      sessions: 0,
      leads: 0,
      users: 0,
      creditTransactions: 0,
      verifiedUsers: 0,
      phoneUsers: 0,
      dailySummaryCaches: 0,
    };

    // 1. Clean up orphaned chats (chats with non-existent chatbotId)
    console.log('🧹 Cleaning up orphaned chats...');
    const chatDelete = await Chat.deleteMany({
      chatbotId: { $nin: existingChatbotIds }
    });
    totalDeleted.chats = chatDelete.deletedCount;
    console.log(`✅ Deleted ${chatDelete.deletedCount} orphaned chats`);

    // 2. Clean up orphaned messages (messages with non-existent chatbotId)
    console.log('🧹 Cleaning up orphaned messages...');
    const messageDelete = await Message.deleteMany({
      chatbotId: { $nin: existingChatbotIds }
    });
    totalDeleted.messages = messageDelete.deletedCount;
    console.log(`✅ Deleted ${messageDelete.deletedCount} orphaned messages`);

    // 3. Clean up orphaned embeddings (embeddings with non-existent chatbotId)
    console.log('🧹 Cleaning up orphaned embeddings...');
    const embeddingDelete = await Embedding.deleteMany({
      chatbotId: { $nin: existingChatbotIds }
    });
    totalDeleted.embeddings = embeddingDelete.deletedCount;
    console.log(`✅ Deleted ${embeddingDelete.deletedCount} orphaned embeddings`);

    // 4. Clean up orphaned user sessions (sessions with non-existent chatbotId)
    console.log('🧹 Cleaning up orphaned user sessions...');
    const sessionDelete = await UserSession.deleteMany({
      chatbotId: { $nin: existingChatbotIds }
    });
    totalDeleted.sessions = sessionDelete.deletedCount;
    console.log(`✅ Deleted ${sessionDelete.deletedCount} orphaned user sessions`);

    // 5. Clean up orphaned lead captures (leads with non-existent chatbotId)
    console.log('🧹 Cleaning up orphaned lead captures...');
    const leadDelete = await LeadCapture.deleteMany({
      chatbotId: { $nin: existingChatbotIds }
    });
    totalDeleted.leads = leadDelete.deletedCount;
    console.log(`✅ Deleted ${leadDelete.deletedCount} orphaned lead captures`);

    // 6. Clean up orphaned users (users with non-existent company)
    console.log('🧹 Cleaning up orphaned users...');
    const userDelete = await User.deleteMany({
      company: { $nin: existingCompanyIds }
    });
    totalDeleted.users = userDelete.deletedCount;
    console.log(`✅ Deleted ${userDelete.deletedCount} orphaned users`);

    // 7. Clean up orphaned credit transactions (transactions with non-existent company)
    console.log('🧹 Cleaning up orphaned credit transactions...');
    const creditDelete = await UserCreditTransaction.deleteMany({
      company: { $nin: existingCompanyIds }
    });
    totalDeleted.creditTransactions = creditDelete.deletedCount;
    console.log(`✅ Deleted ${creditDelete.deletedCount} orphaned credit transactions`);

    // 8. Clean up orphaned verified users (users with non-existent chatbot_id)
    console.log('🧹 Cleaning up orphaned verified users...');
    const verifiedUserDelete = await VerifiedUser.deleteMany({
      chatbot_id: { $nin: existingChatbotIds }
    });
    totalDeleted.verifiedUsers = verifiedUserDelete.deletedCount;
    console.log(`✅ Deleted ${verifiedUserDelete.deletedCount} orphaned verified users`);

    // 9. Clean up orphaned phone users (users with non-existent chatbotId)
    console.log('🧹 Cleaning up orphaned phone users...');
    const phoneUserDelete = await PhoneUser.deleteMany({
      chatbotId: { $nin: existingChatbotIds }
    });
    totalDeleted.phoneUsers = phoneUserDelete.deletedCount;
    console.log(`✅ Deleted ${phoneUserDelete.deletedCount} orphaned phone users`);

    // 10. Clean up daily summary caches (if collection exists)
    try {
      console.log('🧹 Cleaning up daily summary caches...');
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: 'dailysummarycaches' }).toArray();

      if (collections.length > 0) {
        const cacheDelete = await db.collection('dailysummarycaches').deleteMany({
          chatbotId: { $nin: existingChatbotIds }
        });
        totalDeleted.dailySummaryCaches = cacheDelete.deletedCount;
        console.log(`✅ Deleted ${cacheDelete.deletedCount} orphaned daily summary cache entries`);
      } else {
        console.log('ℹ️ Daily summary caches collection does not exist');
      }
    } catch (cacheError) {
      console.log('⚠️ Could not clean daily summary caches:', cacheError.message);
    }

    // Summary
    console.log('\n📊 Cleanup Summary:');
    console.log('='.repeat(50));
    Object.entries(totalDeleted).forEach(([collection, count]) => {
      console.log(`${collection.padEnd(20)}: ${count}`);
    });
    const total = Object.values(totalDeleted).reduce((sum, count) => sum + count, 0);
    console.log('='.repeat(50));
    console.log(`Total orphaned records deleted: ${total}`);

    if (total > 0) {
      console.log('\n✅ Orphaned data cleanup completed successfully!');
    } else {
      console.log('\n✅ No orphaned data found - database is clean!');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  const { connect, disconnect } = require('../db');

  connect()
    .then(() => cleanupOrphanedData())
    .then(() => {
      console.log('🎉 Cleanup script completed successfully');
      return disconnect();
    })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Cleanup script failed:', error);
      disconnect().finally(() => process.exit(1));
    });
}

module.exports = { cleanupOrphanedData };