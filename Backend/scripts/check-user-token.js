/**
 * Check specific user's push token status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';

async function checkUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = process.argv[2] || 'kishor@tr.in';
    console.log(`🔍 Checking user: ${email}\n`);

    const user = await User.findOne({ email: email.toLowerCase() })
      .populate('company')
      .lean();

    if (!user) {
      console.log('❌ USER NOT FOUND!');
      console.log(`   Email: ${email}`);
      console.log('\n   Please check the email address.');
      process.exit(1);
    }

    console.log('✅ USER FOUND');
    console.log('========================================');
    console.log(`Name: ${user.name || 'N/A'}`);
    console.log(`Email: ${user.email}`);
    console.log(`Company: ${user.company?.name || 'N/A'}`);
    console.log(`Company ID: ${user.company?._id || 'N/A'}`);
    console.log(`Is Active: ${user.isActive ? '✅ YES' : '❌ NO'}`);
    console.log(`Push Token: ${user.pushToken ? '✅ YES' : '❌ NO'}`);
    
    if (user.pushToken) {
      console.log(`Token: ${user.pushToken.substring(0, 50)}...`);
      console.log(`Platform: ${user.pushTokenPlatform || 'unknown'}`);
    } else {
      console.log('\n⚠️  NO PUSH TOKEN REGISTERED!');
      console.log('   This is why notifications are not working.');
      console.log('\n   SOLUTION:');
      console.log('   1. Open the mobile app');
      console.log('   2. Login with this account');
      console.log('   3. Allow notification permissions');
      console.log('   4. Wait 10-30 seconds');
      console.log('   5. Token will register automatically');
    }

    console.log('\n========================================');

    // Check company's chatbots
    if (user.company) {
      const Chatbot = require('../models/Chatbot');
      const chatbots = await Chatbot.find({ company: user.company._id }).lean();
      console.log(`\n📊 Company Chatbots: ${chatbots.length}`);
      
      if (chatbots.length > 0) {
        chatbots.forEach((bot, idx) => {
          console.log(`   ${idx + 1}. ${bot.name} (${bot._id})`);
        });
      } else {
        console.log('   ⚠️  No chatbots found for this company');
      }

      // Check recent sessions
      const UserSession = require('../models/UserSession');
      const recentSessions = await UserSession.find({
        chatbot: { $in: chatbots.map(b => b._id) }
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      console.log(`\n📈 Recent Visitor Sessions: ${recentSessions.length} (last 5)`);
      if (recentSessions.length > 0) {
        recentSessions.forEach((session, idx) => {
          const date = new Date(session.createdAt);
          console.log(`   ${idx + 1}. ${session.sessionId.substring(0, 30)}...`);
          console.log(`      Created: ${date.toLocaleString()}`);
        });
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUser();
