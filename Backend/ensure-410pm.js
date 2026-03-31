const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('./models/Company');

async function update() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const result = await Company.updateMany(
            { 'settings.crawler.enabled': true },
            { $set: { 'settings.crawler.schedule': '10 16 * * *' } }
        );
        console.log(`Updated ${result.modifiedCount} companies to 4:10 PM schedule`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
update();
