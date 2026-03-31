const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

async function createTroikaAdmin() {
    try {
        console.log('🔧 [ADMIN SETUP] Starting Troika admin creation...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatAgent';
        await mongoose.connect(mongoUri);
        console.log('✅ [ADMIN SETUP] Connected to MongoDB');

        // Troika admin credentials
        const troikaAdmin = {
            name: 'Troika Admin',
            email: 'admin@troikaitech.com',
            password: 'admin123',
            role: 'super_admin',
            isActive: true,
            permissions: {
                manageCompanies: true,
                manageChatbots: true,
                manageAdmins: true,
                viewAnalytics: true,
            },
        };

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: troikaAdmin.email });
        if (existingAdmin) {
            console.log('⚠️ [ADMIN SETUP] Admin already exists:', {
                id: existingAdmin._id,
                email: existingAdmin.email,
                name: existingAdmin.name,
                role: existingAdmin.role,
            });

            // Update existing admin to ensure correct credentials
            existingAdmin.name = troikaAdmin.name;
            existingAdmin.password = troikaAdmin.password; // Will be hashed by pre-save hook
            existingAdmin.role = 'super_admin';
            existingAdmin.isActive = true;
            existingAdmin.permissions = troikaAdmin.permissions;
            await existingAdmin.save();

            console.log('✅ [ADMIN SETUP] Updated existing admin with new credentials');
        } else {
            // Create new admin
            const admin = new Admin(troikaAdmin);
            await admin.save();

            console.log('✅ [ADMIN SETUP] Created new Troika admin:', {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            });
        }

        // List all admins for verification
        const allAdmins = await Admin.find({}).select('-password');
        console.log('\n📋 [ADMIN SETUP] All admins in database:');
        allAdmins.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin.name} (${admin.email}) - ${admin.role} - Active: ${admin.isActive}`);
        });

        console.log('\n🎉 [ADMIN SETUP] Troika admin setup complete!');
        console.log('📝 [ADMIN SETUP] Login credentials:');
        console.log('   Email: admin@troikaitech.com');
        console.log('   Password: admin123');
        console.log('   Role: super_admin');
        console.log('\n🌐 [ADMIN SETUP] Access admin dashboard at: http://localhost:5174');

        process.exit(0);

    } catch (error) {
        console.error('❌ [ADMIN SETUP] Error creating admin:', error);
        process.exit(1);
    }
}

createTroikaAdmin();
