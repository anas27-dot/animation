const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Chatbot = require('../models/Chatbot');

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {

    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            // Fetch the chatbot (using the ID from previous logs or first active one)
            const chatbot = await Chatbot.findOne({ isActive: true });

            if (chatbot) {
                console.log('Chatbot Found:', chatbot.name);

                const calling = chatbot.settings?.calling_tool;
                console.log('--- Calling Tool Details ---');
                if (calling) {
                    console.log('Enabled:', calling.enabled);
                    console.log('Condition:', calling.condition);
                    console.log('Keywords (IntentKeywords):', chatbot.settings?.intentKeywords);
                } else {
                    console.log('Calling tool settings NOT FOUND in chatbot.settings');
                }
            } else {
                console.log('No active chatbot found.');
            }

        } catch (err) {
            console.error('Error:', err);
        } finally {
            mongoose.connection.close();
        }
    })
    .catch(err => console.error('Connection error:', err));
