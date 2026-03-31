/**
 * Check Push Tokens for All Users
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';

async function checkPushTokens() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find().populate('company').select('name email pushToken pushTokenPlatform company isActive');
    
    console.log(`Found ${users.length} user(s):\n`);
    
    if (users.length === 0) {
      console.log('❌ No users found in database!');
      console.log('   You need to login to the app first to create a user account.\n');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Company: ${user.company?.name || 'None'}`);
        console.log(`   Push Token: ${user.pushToken ? '✅ YES' : '❌ NO'}`);
        if (user.pushToken) {
          console.log(`   Platform: ${user.pushTokenPlatform || 'unknown'}`);
          console.log(`   Token (first 30 chars): ${user.pushToken.substring(0, 30)}...`);
        }
        console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    const usersWithTokens = users.filter(u => u.pushToken);
    console.log(`\nSummary: ${usersWithTokens.length}/${users.length} users have push tokens registered`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkPushTokens();
