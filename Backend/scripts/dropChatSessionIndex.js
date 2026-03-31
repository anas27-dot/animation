const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/chatagent';

async function dropIndex() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        const chatCollection = collections.find(c => c.name === 'chats');

        if (!chatCollection) {
            console.log('Chats collection not found');
            return;
        }

        try {
            await mongoose.connection.db.collection('chats').dropIndex('sessionId_1');
            console.log('Successfully dropped index: sessionId_1');
        } catch (err) {
            if (err.code === 27) {
                console.log('Index sessionId_1 not found (already dropped?)');
            } else {
                console.error('Error dropping index:', err);
            }
        }

    } catch (error) {
        console.error('Script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

dropIndex();
