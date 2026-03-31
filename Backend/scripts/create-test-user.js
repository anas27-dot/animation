/**
 * Quick Script to Create Test User for Mobile App
 * Usage: node scripts/create-test-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/User');
const Company = require('../models/Company');

// Use lowercase database name to match existing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatagent';

async function createTestUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test user credentials
    const userEmail = 'user@troikatech.com';
    const userPassword = 'User@123';

    console.log('\n📋 Creating test user...');
    console.log(`   Email: ${userEmail}`);
    console.log(`   Password: ${userPassword}`);

    // Check if company exists, if not create one
    let company = await Company.findOne({ name: 'Troika Tech Solutions' });
    
    if (!company) {
      console.log('\n🏢 Creating test company...');
      const apiKey = `trok_${crypto.randomBytes(16).toString('hex')}`;
      company = new Company({
        name: 'Troika Tech Solutions',
        domain: 'troikatech.com',
        url: 'troikatech.com',
        apiKey: apiKey,
        email: 'admin@troikatech.com',
        userName: 'Admin User',
        phoneNo: '1234567890',
        managed_by_name: 'Admin',
        password: 'Admin@123', // Required field
        settings: {
          maxChatbots: 10,
          features: {
            tts: true,
            whatsapp: false,
            analytics: true,
          },
        },
        isActive: true,
      });
      await company.save();
      console.log('✅ Test company created');
    } else {
      console.log('✅ Test company already exists');
    }

    // Check if user exists
    let user = await User.findOne({ email: userEmail });
    
    if (user) {
      console.log('\n⚠️  User already exists. Resetting user...');
      // Delete and recreate to avoid validation issues
      await User.deleteOne({ _id: user._id });
      console.log('✅ Old user deleted, creating new one...');
    }
    
    // Create new user (or recreate if deleted)
    user = new User({
      name: 'Test User',
      email: userEmail,
      password: userPassword, // Will be hashed by pre-save hook
      company: company._id,
      role: 'owner',
      isActive: true,
      permissions: {
        manageChatbots: true,
        viewAnalytics: true,
        manageUsers: true,
      },
    });
    await user.save();
    console.log('✅ Test user created successfully');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 USER DASHBOARD LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${userEmail}`);
    console.log(`   Password: ${userPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Use these credentials to login in your mobile app!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestUser();
