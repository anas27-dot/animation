/**
 * Test sending a push notification to a specific user
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendPushNotification, notifyWebsiteVisitor } = require('../services/pushNotificationService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';

async function testNotification() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = process.argv[2] || 'kishor@tr.in';
    console.log(`🔍 Testing notification for: ${email}\n`);

    const user = await User.findOne({ email: email.toLowerCase() })
      .populate('company')
      .lean();

    if (!user) {
      console.log('❌ USER NOT FOUND!');
      process.exit(1);
    }

    console.log('✅ USER FOUND');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Company: ${user.company?.name || 'N/A'}`);
    console.log(`   Push Token: ${user.pushToken ? '✅ YES' : '❌ NO'}\n`);

    if (!user.pushToken) {
      console.log('❌ NO PUSH TOKEN REGISTERED!');
      console.log('\n   SOLUTION:');
      console.log('   1. Open the mobile app');
      console.log('   2. Login with this account');
      console.log('   3. Allow notification permissions');
      console.log('   4. Wait 10-30 seconds');
      console.log('   5. Run this script again');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📤 Sending test notification...\n');

    const result = await sendPushNotification(
      user._id,
      '🧪 Test Notification',
      'This is a test notification from the backend. If you receive this, push notifications are working!',
      {
        type: 'test',
        timestamp: new Date().toISOString(),
      }
    );

    if (result) {
      console.log('✅ NOTIFICATION SENT SUCCESSFULLY!');
      console.log('   Check your mobile app for the notification.');
    } else {
      console.log('❌ FAILED TO SEND NOTIFICATION');
      console.log('   Check backend logs for errors.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testNotification();
