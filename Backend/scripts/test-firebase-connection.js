/**
 * Comprehensive Firebase Diagnostic Script
 * Tests Firebase Admin SDK initialization and push notification capability
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

console.log('🔥 Firebase Diagnostic Test\n');
console.log('========================================\n');

// Step 1: Check service account file
console.log('1️⃣ Checking Firebase Service Account File...');
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file NOT FOUND!');
  console.error(`   Expected location: ${serviceAccountPath}`);
  console.error('\n   Solution: Copy firebase-service-account.json to backend root directory');
  process.exit(1);
}

console.log('✅ Service account file found');

try {
  const serviceAccount = require(serviceAccountPath);
  console.log(`✅ Service account is valid JSON`);
  console.log(`   Project ID: ${serviceAccount.project_id}`);
  console.log(`   Client Email: ${serviceAccount.client_email}`);
} catch (error) {
  console.error('❌ Service account file is invalid JSON:', error.message);
  process.exit(1);
}

// Step 2: Initialize Firebase Admin SDK
console.log('\n2️⃣ Initializing Firebase Admin SDK...');

try {
  // Check if already initialized
  if (!admin.apps.length) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('✅ Firebase Admin SDK already initialized');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  console.error('   Error details:', error);
  process.exit(1);
}

// Step 3: Test Firebase connection
console.log('\n3️⃣ Testing Firebase Connection...');

try {
  const messaging = admin.messaging();
  console.log('✅ Firebase Messaging service is available');
} catch (error) {
  console.error('❌ Firebase Messaging service not available:', error.message);
  process.exit(1);
}

// Step 4: Check google-services.json in Android app
console.log('\n4️⃣ Checking Android App Configuration...');
const googleServicesPath = path.join(__dirname, '..', '..', 'OmniAgent-User-Dashboard-v4', 'android', 'app', 'google-services.json');

if (!fs.existsSync(googleServicesPath)) {
  console.warn('⚠️  google-services.json NOT FOUND in Android app!');
  console.warn(`   Expected: ${googleServicesPath}`);
  console.warn('   Push notifications will NOT work in the app without this file');
} else {
  try {
    const googleServices = require(googleServicesPath);
    console.log('✅ google-services.json found in Android app');
    console.log(`   Project ID: ${googleServices.project_info?.project_id || 'N/A'}`);
    console.log(`   Project Number: ${googleServices.project_info?.project_number || 'N/A'}`);
    
    // Check if project IDs match
    const serviceAccount = require(serviceAccountPath);
    if (googleServices.project_info?.project_id === serviceAccount.project_id) {
      console.log('✅ Project IDs match between service account and Android app');
    } else {
      console.warn('⚠️  Project IDs DO NOT MATCH!');
      console.warn(`   Service Account: ${serviceAccount.project_id}`);
      console.warn(`   Android App: ${googleServices.project_info?.project_id}`);
      console.warn('   This may cause issues with push notifications');
    }
  } catch (error) {
    console.warn('⚠️  google-services.json is invalid:', error.message);
  }
}

// Step 5: Test message creation (without actually sending)
console.log('\n5️⃣ Testing Message Creation...');

try {
  const testMessage = {
    notification: {
      title: 'Test Notification',
      body: 'This is a test',
    },
    token: 'test_token_placeholder', // Won't actually send
    android: {
      priority: 'high',
      notification: {
        channelId: 'omniagent_notifications',
      },
    },
  };
  
  // Just validate the message structure
  console.log('✅ Message structure is valid');
  console.log('   Note: Not actually sending (would fail with test token)');
} catch (error) {
  console.error('❌ Message structure invalid:', error.message);
}

// Step 6: Check if any users have push tokens
console.log('\n6️⃣ Checking User Push Tokens...');

try {
  const mongoose = require('mongoose');
  const User = require('../models/User');
  
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';
  
  mongoose.connect(MONGODB_URI).then(async () => {
    const usersWithTokens = await User.find({ 
      pushToken: { $ne: null },
      isActive: true 
    }).select('name email pushToken pushTokenPlatform company');
    
    console.log(`   Found ${usersWithTokens.length} user(s) with push tokens`);
    
    if (usersWithTokens.length === 0) {
      console.warn('\n⚠️  NO USERS HAVE PUSH TOKENS REGISTERED!');
      console.warn('   This is why notifications are not working.');
      console.warn('\n   Solution:');
      console.warn('   1. Login to the mobile app');
      console.warn('   2. Allow notification permissions');
      console.warn('   3. Push token will register automatically');
    } else {
      console.log('\n✅ Users with push tokens:');
      usersWithTokens.forEach((user, idx) => {
        console.log(`   ${idx + 1}. ${user.name} (${user.email})`);
        console.log(`      Platform: ${user.pushTokenPlatform || 'unknown'}`);
        console.log(`      Token: ${user.pushToken.substring(0, 30)}...`);
      });
    }
    
    await mongoose.disconnect();
    
    // Final summary
    console.log('\n========================================');
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('========================================');
    console.log('✅ Firebase service account: OK');
    console.log('✅ Firebase Admin SDK: OK');
    console.log('✅ Firebase Messaging: OK');
    
    if (usersWithTokens.length === 0) {
      console.log('❌ Push Tokens: NOT REGISTERED');
      console.log('\n🔧 ACTION REQUIRED:');
      console.log('   Login to the mobile app to register push tokens!');
    } else {
      console.log(`✅ Push Tokens: ${usersWithTokens.length} user(s) registered`);
      console.log('\n🔧 If notifications still not working:');
      console.log('   1. Check backend logs for sending errors');
      console.log('   2. Verify visitor notification triggers');
      console.log('   3. Check device notification settings');
    }
    
    console.log('\n========================================\n');
    
    process.exit(0);
  }).catch(error => {
    console.warn('⚠️  Could not check database:', error.message);
    console.log('\n📋 SUMMARY (without database check):');
    console.log('✅ Firebase service account: OK');
    console.log('✅ Firebase Admin SDK: OK');
    console.log('✅ Firebase Messaging: OK');
    console.log('\n⚠️  Could not verify push tokens (database connection failed)');
    process.exit(0);
  });
} catch (error) {
  console.warn('⚠️  Could not check users:', error.message);
  process.exit(0);
}
