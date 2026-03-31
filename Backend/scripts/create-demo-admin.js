const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

async function createDemoAdmin() {
  try {
    console.log('🔧 [DEMO ADMIN] Starting demo admin creation...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-agent';
    await mongoose.connect(mongoUri);
    console.log('✅ [DEMO ADMIN] Connected to MongoDB');

    // Demo admin credentials
    const demoAdmin = {
      name: 'Demo Admin',
      email: 'demo@troika.ai',
      password: 'demo123',
      role: 'super_admin',
      isActive: true,
      permissions: {
        manageCompanies: true,
        manageChatbots: true,
        manageAdmins: true,
        viewAnalytics: true,
      },
    };

    // Check if demo admin already exists
    const existingAdmin = await Admin.findOne({ email: demoAdmin.email });
    if (existingAdmin) {
      console.log('⚠️ [DEMO ADMIN] Demo admin already exists:', {
        id: existingAdmin._id,
        email: existingAdmin.email,
        name: existingAdmin.name,
        role: existingAdmin.role,
      });

      // Update existing admin to ensure it has super_admin role
      existingAdmin.role = 'super_admin';
      existingAdmin.isActive = true;
      existingAdmin.permissions = demoAdmin.permissions;
      await existingAdmin.save();

      console.log('✅ [DEMO ADMIN] Updated existing demo admin to super_admin role');
    } else {
      // Create new demo admin
      const admin = new Admin(demoAdmin);
      await admin.save();

      console.log('✅ [DEMO ADMIN] Created new demo admin:', {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      });
    }

    // List all admins for verification
    const allAdmins = await Admin.find({}).select('-password');
    console.log('\n📋 [DEMO ADMIN] All admins in database:');
    allAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name} (${admin.email}) - ${admin.role} - Active: ${admin.isActive}`);
    });

    console.log('\n🎉 [DEMO ADMIN] Demo admin setup complete!');
    console.log('📝 [DEMO ADMIN] Login credentials:');
    console.log('   Email: demo@troika.ai');
    console.log('   Password: demo123');
    console.log('   Role: super_admin');

    process.exit(0);

  } catch (error) {
    console.error('❌ [DEMO ADMIN] Error creating demo admin:', error);
    process.exit(1);
  }
}

createDemoAdmin();
