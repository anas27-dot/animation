const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('./models/Company');
const Chatbot = require('./models/Chatbot');

async function checkIds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const companies = await Company.find({ 'settings.crawler.enabled': true }).limit(3);

        for (const comp of companies) {
            const chatbots = await Chatbot.find({ company: comp._id });
            console.log(`Company: ${comp.name} (${comp._id})`);
            console.log(`Chatbots: ${chatbots.map(c => `${c.name} (${c._id})`).join(', ')}`);
            console.log('---');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkIds();
