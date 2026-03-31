const mongoose = require('mongoose');
require('dotenv').config();
const Embedding = require('./models/Embedding');
const crypto = require('crypto');

async function backfill() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const embeddings = await Embedding.find({ contentHash: { $exists: false } });
        console.log(`📊 Found ${embeddings.length} embeddings without contentHash`);

        let updatedCount = 0;
        for (const emb of embeddings) {
            const hash = crypto.createHash('md5').update(emb.content).digest('hex');
            await Embedding.updateOne({ _id: emb._id }, { $set: { contentHash: hash } });
            updatedCount++;
            if (updatedCount % 100 === 0) console.log(`Processed ${updatedCount}...`);
        }

        console.log(`✅ Finished backfilling ${updatedCount} content hashes`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
backfill();
