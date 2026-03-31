const mongoose = require('mongoose');
const fs = require('fs');

const uri = 'mongodb+srv://troika_pratik_2001:uAo1a8UND6sO2J3u@chatbot.tgmlyji.mongodb.net/?retryWrites=true&w=majority&appName=chatbot';

async function extract() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected!');

        const collections = await mongoose.connection.db.listCollections().toArray();
        const availableCollNames = collections.map(c => c.name);
        console.log('Collections:', availableCollNames);

        const results = {};

        // Comprehensive collection list mapping to dashboard pages
        const collectionsToSample = [
            'messages',
            'usersessions',
            'leadcaptures',
            'hotleads',
            'followupleads',
            'verifiedusers',
            'dailysummaries',
            'credittransactions',
            'whatsappproposalhistories',
            'emailsenthistories',
            'chatbots'
        ];

        for (const collName of collectionsToSample) {
            if (availableCollNames.includes(collName)) {
                console.log(`Sampling ${collName}...`);
                results[collName] = await mongoose.connection.db.collection(collName)
                    .find({})
                    .sort({ createdAt: -1, timestamp: -1 })
                    .limit(50)
                    .toArray();
            } else {
                console.warn(`Collection ${collName} not found!`);
            }
        }

        fs.writeFileSync('full_data_dump.json', JSON.stringify(results, null, 2));
        console.log('Data dumped to full_data_dump.json');

    } catch (err) {
        console.error('Error during extraction:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

extract();
