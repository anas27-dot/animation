require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const Chatbot = require('../models/Chatbot');

async function checkSettings() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const bots = await Chatbot.find({});
        console.log(`Found ${bots.length} chatbots.`);

        const output = bots.map(bot => ({
            id: bot._id,
            name: bot.name,
            settings: bot.settings
        }));

        fs.writeFileSync('chatbot_settings_dump.json', JSON.stringify(output, null, 2), 'utf8');
        console.log('Dumped to chatbot_settings_dump.json');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSettings();
