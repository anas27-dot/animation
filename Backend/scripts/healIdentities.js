const mongoose = require('mongoose');
const UserSession = require('../models/UserSession');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

const MONGODB_URI = 'mongodb://localhost:27017/chatagent';

async function healUserIdentities() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Get all sessions that have a phone number (authenticated users)
        console.log('Fetching authenticated sessions...');
        const authenticatedSessions = await UserSession.find({
            phone: { $exists: true, $ne: null }
        }).select('sessionId phone email name');

        console.log(`Found ${authenticatedSessions.length} authenticated sessions.`);

        let updatedMessagesCount = 0;
        let updatedChatsCount = 0;

        for (const session of authenticatedSessions) {
            const { sessionId, phone, email, name } = session;

            // 2. Update all messages for this session that are missing the phone/email
            const messageUpdateResult = await Message.updateMany(
                {
                    sessionId: sessionId,
                    $or: [
                        { phone: { $exists: false } },
                        { phone: null }
                    ]
                },
                {
                    $set: {
                        phone: phone,
                        email: email || null,
                        name: name || null
                    }
                }
            );

            if (messageUpdateResult.modifiedCount > 0) {
                console.log(`Synced ${messageUpdateResult.modifiedCount} messages for session ${sessionId} (Phone: ${phone})`);
                updatedMessagesCount += messageUpdateResult.modifiedCount;
            }

            // 3. Update Chat record as well
            const chatUpdateResult = await Chat.updateOne(
                {
                    sessionId: sessionId,
                    $or: [
                        { phone: { $exists: false } },
                        { phone: null }
                    ]
                },
                { $set: { phone: phone } }
            );

            if (chatUpdateResult.modifiedCount > 0) {
                updatedChatsCount += chatUpdateResult.modifiedCount;
            }
        }

        console.log(`\n--- HEAL COMPLETE ---`);
        console.log(`Total Messages Updated: ${updatedMessagesCount}`);
        console.log(`Total Chats Updated: ${updatedChatsCount}`);

    } catch (error) {
        console.error('Heal script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

healUserIdentities();
