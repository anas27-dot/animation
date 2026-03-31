/**
 * Check if visitor notifications are being triggered
 * This script checks recent sessions and verifies notification flow
 */

require('dotenv').config();
const mongoose = require('mongoose');
const UserSession = require('../models/UserSession');
const Chatbot = require('../models/Chatbot');
const User = require('../models/User');
const Company = require('../models/Company');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';

async function checkVisitorNotifications() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all companies
    const companies = await Company.find();
    console.log(`Found ${companies.length} company(ies)\n`);

    for (const company of companies) {
      console.log(`\n📊 Company: ${company.name} (${company._id})`);
      
      // Get chatbots for this company
      const chatbots = await Chatbot.find({ company: company._id });
      const chatbotIds = chatbots.map(cb => cb._id.toString());
      
      console.log(`   Chatbots: ${chatbots.length}`);
      
      if (chatbotIds.length === 0) {
        console.log('   ⚠️  No chatbots found');
        continue;
      }

      // Get recent sessions (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentSessions = await UserSession.find({
        chatbotId: { $in: chatbotIds },
        createdAt: { $gte: oneDayAgo }
      }).sort({ createdAt: -1 }).limit(10);

      console.log(`   Recent sessions (last 24h): ${recentSessions.length}`);

      // Check users with push tokens
      const users = await User.find({
        company: company._id,
        isActive: true
      }).select('name email pushToken pushTokenPlatform');

      const usersWithTokens = users.filter(u => u.pushToken);
      console.log(`   Users with push tokens: ${usersWithTokens.length}/${users.length}`);

      if (usersWithTokens.length === 0) {
        console.log('   ❌ NO USERS HAVE PUSH TOKENS REGISTERED!');
        console.log('      This is why notifications are not working.');
        console.log('      Solution: Login to the app to register push tokens.');
        users.forEach(u => {
          console.log(`      - ${u.name} (${u.email})`);
        });
      } else {
        console.log('   ✅ Users with tokens:');
        usersWithTokens.forEach(u => {
          console.log(`      - ${u.name} (${u.email}) - Platform: ${u.pushTokenPlatform || 'unknown'}`);
        });
      }

      // Check recent sessions
      if (recentSessions.length > 0) {
        console.log(`\n   Recent visitors (last 10):`);
        recentSessions.slice(0, 5).forEach((session, idx) => {
          console.log(`      ${idx + 1}. Session: ${session.sessionId.substring(0, 30)}...`);
          console.log(`         Created: ${session.createdAt}`);
          console.log(`         Phone: ${session.phone || 'none'}`);
          console.log(`         Email: ${session.email || 'none'}`);
        });
      } else {
        console.log('   ⚠️  No recent sessions found');
      }
    }

    console.log('\n\n🔍 DIAGNOSIS:');
    console.log('========================================');
    console.log('For notifications to work, you need:');
    console.log('1. ✅ Visitors arriving (sessions being created)');
    console.log('2. ✅ Users logged in to the app (push tokens registered)');
    console.log('3. ✅ Backend sending notifications when new sessions created');
    console.log('4. ✅ Notification permissions enabled on device');
    console.log('\nIf #2 is missing, notifications will NOT work!');
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkVisitorNotifications();
