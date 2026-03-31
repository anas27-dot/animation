const mongoose = require('mongoose');
require('dotenv').config();
const Embedding = require('./models/Embedding');

async function simulate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        // Change one specific URL's hash to force an update
        const result = await Embedding.updateOne(
            { chatbotId: '696b5b6da23b45606e835daa', 'metadata.url': 'https://troikatech.in/' },
            { $set: { contentHash: 'INVALID_HASH_FOR_TESTING' } }
        );
        console.log('Simulated update: ' + result.modifiedCount + ' records modified');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
simulate();
