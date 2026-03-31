const mongoose = require('mongoose');
require('dotenv').config();
const Embedding = require('./models/Embedding');
const Chatbot = require('./models/Chatbot');

async function debugEmbeddings() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const chatbotId = '6969bc08018294f83e410083';
        console.log(`Searching for embeddings for chatbotId: ${chatbotId}`);

        const count = await Embedding.countDocuments({ chatbotId });
        console.log(`Total embeddings found: ${count}`);

        const embeddings = await Embedding.find({ chatbotId }).lean();

        const fs = require('fs');
        let dump = '--- FULL EMBEDDING CONTENT DUMP ---\n';
        embeddings.forEach((e, i) => {
            dump += `\nCHUNK ${i + 1} (${e.metadata?.filename || e.metadata?.title || 'Unknown'}):\n`;
            dump += '------------------------------------\n';
            dump += e.content;
            dump += '\n------------------------------------\n';
        });

        fs.writeFileSync('debug_content.txt', dump);
        console.log('✅ Full content dumped to debug_content.txt');

        const chatbot = await Chatbot.findById(chatbotId).lean();
        if (chatbot) {
            fs.writeFileSync('chatbot_clean.json', JSON.stringify({
                name: chatbot.name,
                persona: chatbot.persona,
                settings: chatbot.settings
            }, null, 2));
            console.log('✅ Clean data dumped to chatbot_clean.json');

            console.log('--- PERSONA DUMP ---');
            console.log(chatbot.persona);
            console.log('\n--- SETTINGS DUMP ---');
            console.log(JSON.stringify(chatbot.settings, null, 2));
            console.log(`KnowledgeBase count in Chatbot model: ${chatbot.knowledgeBase?.length || 0}`);
            if (chatbot.knowledgeBase?.length > 0) {
                console.log('KB Item 1:', JSON.stringify({
                    title: chatbot.knowledgeBase[0].title,
                    contentPreview: chatbot.knowledgeBase[0].content?.substring(0, 200),
                    metadata: chatbot.knowledgeBase[0].metadata
                }, null, 2));
            }
        } else {
            console.log('Chatbot not found in database.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugEmbeddings();
