const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('./models/Company');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const companies = await Company.find({ 'settings.crawler.enabled': true });
        console.log('Enabled companies:', JSON.stringify(companies.map(c => ({
            name: c.name,
            domain: c.domain,
            schedule: c.settings?.crawler?.schedule,
            enabled: c.settings?.crawler?.enabled
        })), null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
