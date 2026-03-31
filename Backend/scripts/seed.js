/**
 * Database Seeding Script
 * Creates initial admin user and optional test data
 * 
 * Usage: node scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Import models
const Admin = require('../models/Admin');
const Company = require('../models/Company');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    try {
      const { host } = new URL(MONGODB_URI.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
      console.log('✅ Connected to MongoDB:', host || '(configured)');
    } catch {
      console.log('✅ Connected to MongoDB');
    }

    // Create Admin User
    console.log('\n📝 Creating admin user...');
    const adminEmail = 'admin@troikatech.com';
    const adminPassword = 'Admin@123';

    // Check if admin already exists
    let admin = await Admin.findOne({ email: adminEmail });
    
    if (admin) {
      console.log('⚠️  Admin user already exists. Updating password and ensuring active...');
      // Hash password and set directly to avoid double hashing from pre-save hook
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      // Login requires isActive: true — re-enable if it was turned off
      await Admin.updateOne(
        { _id: admin._id },
        {
          $set: {
            password: hashedPassword,
            isActive: true,
            role: 'super_admin',
          },
        }
      );
      console.log('✅ Admin password updated (and account active for login)');
    } else {
      // Create admin with plain password - pre-save hook will hash it
      admin = new Admin({
        name: 'Admin User',
        email: adminEmail,
        password: adminPassword, // Will be hashed by pre-save hook
        role: 'super_admin',
        isActive: true,
        permissions: {
          manageCompanies: true,
          manageChatbots: true,
          manageAdmins: true,
          viewAnalytics: true,
        },
      });

      await admin.save();
      console.log('✅ Admin user created successfully');
    }

    console.log('\n📋 Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Create Test Company (Optional)
    const createTestCompany = process.env.CREATE_TEST_COMPANY !== 'false';
    
    if (createTestCompany) {
      console.log('\n🏢 Creating test company...');
      
      let company = await Company.findOne({ name: 'Troika Tech Solutions' });
      
      if (!company) {
        const apiKey = `trok_${crypto.randomBytes(16).toString('hex')}`;
        const companyLoginPassword = 'Company@123';
        const hashedCompanyPassword = await bcrypt.hash(companyLoginPassword, 10);
        company = new Company({
          name: 'Troika Tech Solutions',
          domain: 'troikatech.com',
          apiKey: apiKey,
          userName: 'troika_company',
          email: 'company@troikatech.com',
          password: hashedCompanyPassword,
          phoneNo: '+10000000000',
          managed_by_name: 'Seed Script',
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
        console.log(`   Company Name: ${company.name}`);
        console.log(`   API Key: ${apiKey}`);
        console.log('   (You can use this API key for chatbot API calls)');

        // Create Test User for the company
        console.log('\n👤 Creating test user...');
        const userEmail = 'user@troikatech.com';
        const userPassword = 'User@123';

        let user = await User.findOne({ email: userEmail });
        
        if (user) {
          console.log('⚠️  Test user already exists');
        } else {
          // Create user with plain password - pre-save hook will hash it
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
          console.log('✅ Test user created');
          console.log('\n📋 User Dashboard Login Credentials:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Email:    ${userEmail}`);
          console.log(`   Password: ${userPassword}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
      } else {
        console.log('⚠️  Test company already exists');
      }
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Login to Admin Dashboard: http://localhost:5174');
    console.log('   2. Use admin credentials to login');
    console.log('   3. Create a chatbot with persona and knowledge base');
    console.log('   4. Copy the chatbot ID and use it in frontend');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run seed
seed();

