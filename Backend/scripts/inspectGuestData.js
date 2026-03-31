const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message'); // Assuming usage of Message model
const UserSession = require('../models/UserSession');

const MONGODB_URI = 'mongodb://localhost:27017/chatagent';

async function inspectGuestData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find recent messages created in the last 24 hours that don't have a phone number
        const recentGuestMessages = await Message.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            phone: { $exists: false }
        }).sort({ createdAt: -1 }).limit(20);

        console.log(`Found ${recentGuestMessages.length} recent messages without phone number:`);

        const sessionIds = [...new Set(recentGuestMessages.map(m => m.sessionId))];
        console.log('Unique Session IDs involved:', sessionIds);

        // Check sessions for these IDs
        const sessions = await UserSession.find({ sessionId: { $in: sessionIds } });

        for (const sessionId of sessionIds) {
            console.log(`\n--- Inspecting Session: ${sessionId} ---`);
            const msgs = recentGuestMessages.filter(m => m.sessionId === sessionId);
            const session = sessions.find(s => s.sessionId === sessionId);

            console.log(`Message Count (in sample): ${msgs.length}`);
            console.log(`First Msg Time: ${msgs[0]?.createdAt}`);
            console.log(`Session Record Found: ${!!session}`);
            if (session) {
                console.log(`Session Phone: ${session.phone}`);
                console.log(`Session Email: ${session.email}`);
                console.log(`Session Verified: ${session.verified}`);
            } else {
                console.log('No UserSession record for this sessionId');
            }

            // Check Chat record
            const chat = await Chat.findOne({ sessionId });
            if (chat) {
                console.log(`Chat Record Phone: ${chat.phone}`);
                console.log(`Chat Record ConversationId: ${chat.conversationId}`);
            } else {
                console.log('No Chat record found for this sessionId');
            }
        }

    } catch (error) {
        console.error('Script error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

inspectGuestData();
