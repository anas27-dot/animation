const mongoose = require('mongoose');

const uri = 'mongodb+srv://troika_pratik_2001:uAo1a8UND6sO2J3u@chatbot.tgmlyji.mongodb.net/?retryWrites=true&w=majority&appName=chatbot';

async function extract() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected!');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const results = {};

        // Major collections to sample
        const collectionsToSample = ['messages', 'usersessions', 'leadcaptures', 'dailysummaries'];

        for (const collName of collectionsToSample) {
            if (collections.some(c => c.name === collName)) {
                console.log(`Sampling ${collName}...`);
                results[collName] = await mongoose.connection.db.collection(collName)
                    .find({})
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .toArray();
            }
        }

        console.log('---DATA_START---');
        console.log(JSON.stringify(results, null, 2));
        console.log('---DATA_END---');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

extract();
