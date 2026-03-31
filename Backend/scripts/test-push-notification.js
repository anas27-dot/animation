/**
 * Test Push Notification Script
 * Run this to check if push notifications are configured correctly
 * 
 * Usage: node scripts/test-push-notification.js [userEmail]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const { sendPushNotification, notifyWebsiteVisitor } = require('../services/pushNotificationService');
const admin = require('firebase-admin');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';
const userEmail = process.argv[2] || 'realestate@gmail.com';

async function testPushNotifications() {
  try {
    console.log('🔍 Testing Push Notification Setup...\n');

    // Connect to MongoDB
    console.log('1️⃣ Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`2️⃣ Finding user: ${userEmail}...`);
    const user = await User.findOne({ email: userEmail }).populate('company');
    
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }
    console.log(`✅ User found: ${user.name} (${user.email})\n`);

    // Check push token
    console.log('3️⃣ Checking push token...');
    if (!user.pushToken) {
      console.error('❌ No push token registered for this user!');
      console.error('   The app needs to be installed and logged in to register a push token.');
      console.error('   Make sure:');
      console.error('   1. App is installed on your device');
      console.error('   2. You are logged in');
      console.error('   3. Notification permissions are granted');
      process.exit(1);
    }
    console.log(`✅ Push token found: ${user.pushToken.substring(0, 20)}...`);
    console.log(`   Platform: ${user.pushTokenPlatform || 'unknown'}\n`);

    // Check Firebase initialization
    console.log('4️⃣ Checking Firebase Admin SDK...');
    try {
      // Try to initialize Firebase if not already done
      const path = require('path');
      const fs = require('fs');
      const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ Firebase service account file not found!');
        console.error(`   Expected at: ${serviceAccountPath}`);
        process.exit(1);
      }
      console.log('✅ Firebase service account file found');

      if (!admin.apps.length) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin SDK initialized');
      } else {
        console.log('✅ Firebase Admin SDK already initialized');
      }
    } catch (error) {
      console.error('❌ Firebase initialization error:', error.message);
      process.exit(1);
    }

    // Test sending notification
    console.log('\n5️⃣ Sending test notification...');
    const result = await sendPushNotification(
      user._id,
      '🧪 Test Notification',
      'If you see this, push notifications are working!',
      {
        type: 'test',
        timestamp: new Date().toISOString(),
      }
    );

    if (result) {
      console.log('✅ Test notification sent successfully!');
      console.log('   Check your phone for the notification.');
    } else {
      console.error('❌ Failed to send test notification');
      process.exit(1);
    }

    // Check company and chatbot
    if (user.company) {
      console.log(`\n6️⃣ Testing visitor notification for company: ${user.company.name}...`);
      const result2 = await notifyWebsiteVisitor(
        user.company._id,
        {
          page: '/test',
          referrer: 'test-script',
          userAgent: 'test-script',
          chatbotId: 'test',
          chatbotName: 'Test Chatbot',
        }
      );
      console.log(`✅ Visitor notification sent to ${result2} user(s)`);
    }

    console.log('\n✅ All tests passed! Push notifications are working correctly.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testPushNotifications();
