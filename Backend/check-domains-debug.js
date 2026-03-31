const mongoose = require('mongoose');
const Chatbot = require('./models/Chatbot');
const dotenv = require('dotenv');

dotenv.config();

const chatbotId = '6981bbb8555f730d5d118ad2';

async function checkAllowedDomains() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const chatbot = await Chatbot.findById(chatbotId);
        if (!chatbot) {
            console.log(`Chatbot with ID ${chatbotId} not found`);
        } else {
            console.log(`Chatbot found: ${chatbot.name}`);
            console.log('Allowed Domains:', chatbot.settings?.allowedDomains);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkAllowedDomains();
