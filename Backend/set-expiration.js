const mongoose = require('mongoose');
require('dotenv').config();

async function setExpiration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Company = require('./models/Company');

    // Set expiration to 22 days from now
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 22);

    console.log('Setting expiration to:', expirationDate);

// First find the document
const company = await Company.findById('696a0ba7cd3ce8245e0f50dc');

if (!company) {
  console.log('Company not found');
  return;
}

// Set the expiresAt field
company.credits.expiresAt = expirationDate;

// Mark the nested object as modified so Mongoose saves it
company.markModified('credits');

// Save the document
const result = await company.save();

    console.log('✅ Updated company credits:');
    console.log(JSON.stringify(result.credits, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

setExpiration();