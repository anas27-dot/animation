/**
 * Create User Account for Real Estate Login
 * Usage: node scripts/create-user-realestate.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');

// Use lowercase database name to match existing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatagent';

async function createRealEstateUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // User credentials from the login attempt
    const userEmail = 'realestate@gmail.com';
    const userPassword = '9822667827';
    const userName = 'Real Estate User';

    console.log('\n📋 Creating user account...');
    console.log(`   Email: ${userEmail}`);
    console.log(`   Password: ${userPassword}`);

    // Find or create company
    let company = await Company.findOne({ 
      $or: [
        { name: 'Real Estate Company' },
        { domain: 'realestate.com' },
        { 'email': { $regex: /realestate/i } }
      ]
    });
    
    if (!company) {
      // Try to find any active company
      company = await Company.findOne({ isActive: true });
      if (company) {
        console.log(`✅ Using existing company: ${company.name}`);
      } else {
        console.log('\n🏢 Creating company...');
        const crypto = require('crypto');
        const apiKey = `trok_${crypto.randomBytes(16).toString('hex')}`;
        company = new Company({
          name: 'Real Estate Company',
          domain: `realestate-${Date.now()}.com`,
          url: `realestate-${Date.now()}.com`,
          apiKey: apiKey,
          email: 'admin@realestate.com',
          userName: 'Admin User',
          phoneNo: '9822667827',
          managed_by_name: 'Admin',
          password: 'Admin@123',
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
        console.log('✅ Company created');
      }
    } else {
      console.log(`✅ Using existing company: ${company.name}`);
    }

    // Check if user exists
    let user = await User.findOne({ email: userEmail });
    
    if (user) {
      console.log('\n⚠️  User already exists. Resetting user...');
      await User.deleteOne({ _id: user._id });
      console.log('✅ Old user deleted, creating new one...');
    }
    
    // Create new user
    user = new User({
      name: userName,
      email: userEmail,
      password: userPassword,
      company: company._id,
      role: 'owner',
      isActive: true,
      phone: '9822667827',
      permissions: {
        manageChatbots: true,
        viewAnalytics: true,
        manageUsers: true,
      },
    });
    await user.save();
    console.log('✅ User created successfully');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${userEmail}`);
    console.log(`   Password: ${userPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ You can now login with these credentials!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createRealEstateUser();
