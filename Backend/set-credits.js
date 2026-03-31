require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');

async function setCreditsForCompany(companyId, totalCredits) {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.log('❌ MONGODB_URI environment variable is not set');
      return;
    }
    await mongoose.connect(mongoUri);

    console.log(`🔧 Setting ${totalCredits} credits for company: ${companyId}`);

    // Find the company
    const company = await Company.findById(companyId);

    if (!company) {
      console.log(`❌ Company with ID ${companyId} not found`);
      return;
    }

    // Set credits for the company
    company.credits = {
      total: totalCredits,
      used: 0,
      remaining: totalCredits,
      expiresAt: null, // No expiration
      lastResetAt: new Date()
    };

    await company.save();

    console.log(`✅ Successfully set ${totalCredits} credits for company "${company.name}"`);
    console.log(`   Credits: ${JSON.stringify(company.credits, null, 2)}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error setting credits:', error);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node set-credits.js <companyId> <totalCredits>');
  console.log('Example: node set-credits.js 696a0ba7cd3ce8245e0f50dc 20');
  console.log('Note: This sets credits at the company level');
  process.exit(1);
}

const [companyId, totalCreditsStr] = args;
const totalCredits = parseInt(totalCreditsStr);

if (isNaN(totalCredits) || totalCredits < 0) {
  console.log('❌ Total credits must be a valid positive number');
  process.exit(1);
}

setCreditsForCompany(companyId, totalCredits);