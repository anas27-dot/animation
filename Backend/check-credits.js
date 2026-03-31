require('dotenv').config();
const mongoose = require('mongoose');
const Chatbot = require('./models/Chatbot');
const Company = require('./models/Company');

async function checkCredits() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.log('❌ MONGODB_URI environment variable is not set');
      return;
    }
    await mongoose.connect(mongoUri);

    console.log('🔍 Checking company credits for chatbots in database...\n');

    // Find all chatbots and populate companies
    const chatbots = await Chatbot.find({}).populate('company').select('name company').limit(10);

    if (chatbots.length === 0) {
      console.log('❌ No chatbots found in database');
      return;
    }

    console.log(`📊 Found ${chatbots.length} chatbot(s):\n`);

    chatbots.forEach((bot, index) => {
      console.log(`${index + 1}. ${bot.name}`);
      console.log(`   Chatbot ID: ${bot._id}`);

      if (!bot.company) {
        console.log(`   ❌ No company associated with this chatbot`);
      } else {
        console.log(`   Company: ${bot.company.name} (ID: ${bot.company._id})`);
        console.log(`   Company Credits: ${JSON.stringify(bot.company.credits, null, 2)}`);

        if (!bot.company.credits) {
          console.log(`   ❌ No credits field found for company`);
        } else if (bot.company.credits.total === undefined) {
          console.log(`   ⚠️ Credits field exists but 'total' is undefined`);
        } else if (bot.company.credits.remaining <= 0) {
          console.log(`   🚫 Credits exhausted (${bot.company.credits.remaining} remaining)`);
        } else {
          console.log(`   ✅ Credits available (${bot.company.credits.remaining} remaining of ${bot.company.credits.total})`);
        }
      }
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error checking credits:', error);
  }
}

checkCredits();