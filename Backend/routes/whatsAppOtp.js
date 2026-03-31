const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const sendWhatsAppOtp = require("../utils/sendWhatsAppOtp");
const PhoneUser = require("../models/PhoneUser");
const VerifiedUser = require("../models/VerifiedUser");
const OtpRateLimit = require("../models/OtpRateLimit");
const { generateToken } = require("../utils/jwtHelper");
const { v4: uuidv4 } = require("uuid");
const { saveExplicitMemory, consolidateChatToMemory } = require('../services/memoryService');
const Message = require('../models/Message');
const { strictLimiter } = require('../middleware/rateLimiter');

const otpStore = new Map();
const MAX_OTP_ATTEMPTS = parseInt(process.env.MAX_OTP_ATTEMPTS) || 10;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (24 * 60 * 60 * 1000);

const RATE_LIMIT_EXEMPT_PHONES = process.env.RATE_LIMIT_EXEMPT_PHONES
    ? process.env.RATE_LIMIT_EXEMPT_PHONES.split(',').map(phone => phone.trim()).filter(Boolean)
    : ["9834699858", "7715827544"];

const isRateLimitExempt = (phone) => {
    if (!phone) return false;
    const normalizedPhone = phone.replace(/\D/g, "");
    return RATE_LIMIT_EXEMPT_PHONES.some(exemptPhone =>
        normalizedPhone.endsWith(exemptPhone) || normalizedPhone === exemptPhone
    );
};

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/send", strictLimiter, async (req, res) => {
    const { phone, chatbotId } = req.body;
    if (!phone || !chatbotId) return res.status(400).json({ success: false, error: "Missing fields" });

    try {
        const isExempt = isRateLimitExempt(phone);
        const currentTime = new Date();
        const identifier = { phone };
        let rateLimit = !isExempt ? await OtpRateLimit.findOne(identifier) : null;

        if (rateLimit) {
            if ((currentTime - rateLimit.windowStart >= RATE_LIMIT_WINDOW_MS)) {
                rateLimit.windowStart = currentTime; rateLimit.attempts = 0;
            } else if (rateLimit.attempts >= MAX_OTP_ATTEMPTS) {
                return res.status(429).json({ success: false, error: "Rate limit exceeded" });
            }
            rateLimit.attempts += 1; rateLimit.lastAttempt = currentTime;
            await rateLimit.save();
        } else if (!isExempt) {
            await OtpRateLimit.create({ ...identifier, attempts: 1, windowStart: currentTime, lastAttempt: currentTime });
        }

        const otp = generateOtp();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        const key = `${phone}-${chatbotId}`;
        otpStore.set(key, { otp, expiresAt });
        console.log(`📝 OTP stored for ${key}:`, otp);

        const sent = await sendWhatsAppOtp(phone, otp);
        if (sent) return res.json({ success: true, message: "OTP sent" });
        else throw new Error("WhatsApp API failed");
    } catch (error) {
        console.error("❌ OTP Send Error:", error);
        return res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
});

/**
 * POST /verify
 * 🚀 CRITICAL: ID STABILIZATION LOGIC ADDED
 */
router.post("/verify", strictLimiter, async (req, res) => {
    const { phone, otp, chatbotId, name, sessionId } = req.body;

    if (!phone || !otp || !chatbotId) return res.status(400).json({ success: false, error: "Missing fields" });

    const key = `${phone}-${chatbotId}`;
    const stored = otpStore.get(key);

    if (!stored) return res.status(404).json({ success: false, error: "OTP expired/not found" });
    if (Date.now() > stored.expiresAt) return res.status(400).json({ success: false, error: "OTP expired" });
    if (stored.otp !== otp) return res.status(400).json({ success: false, error: "Invalid OTP" });

    try {
        // 🚀 1. ID STABILIZATION LOGIC
        // Find ALL users with this phone number, sorted by creation time (Oldest First)
        // This ensures we always grab the ORIGINAL user ID, which holds the memories.
        const existingUsers = await PhoneUser.find({ phone, chatbotId }).sort({ createdAt: 1 });

        let user;

        if (existingUsers.length > 0) {
            // Pick the OLDEST record (Index 0) as the "Real" User
            user = existingUsers[0];
            console.log(`👤 [Auth] Found existing user (ID: ${user._id})`);

            // Update details
            if (name) user.name = name;
            user.verified = true;
            await user.save();

            // 🧹 SELF-HEALING: Delete any newer duplicates to clean up DB
            if (existingUsers.length > 1) {
                const duplicateIds = existingUsers.slice(1).map(u => u._id);
                console.warn(`⚠️ [Auth] Found ${duplicateIds.length} duplicates. Deleting newer ones to stabilize ID.`);
                await PhoneUser.deleteMany({ _id: { $in: duplicateIds } });
            }
        } else {
            // Create New
            console.log(`👤 [Auth] Creating NEW user.`);
            user = await PhoneUser.create({ phone, name: name || "User", chatbotId, verified: true });
        }

        await VerifiedUser.create({
            phone, chatbot_id: chatbotId, session_id: uuidv4(), verified_at: new Date(), provider: "whatsapp-otp",
        });

        otpStore.delete(key);

        // 🚀 2. INJECT INTO MEMORY (Use the Stable ID)
        if (name) {
            console.log(`🧠 [Auth] Syncing name to Memory for Stable ID ${user._id}`);
            // Save Name
            await saveExplicitMemory(
                user._id.toString(),
                chatbotId,
                `User's name is ${name}`,
                phone // Pass phone for future redundancy
            );
            // Save Phone
            await saveExplicitMemory(
                user._id.toString(),
                chatbotId,
                `User's contact number is ${phone}`,
                phone
            );
        }

        // 🚀 3. SESSION MIGRATION
        if (sessionId) {
            console.log(`🔄 [Auth] Migrating session ${sessionId} to Stable ID ${user._id}`);
            await Message.updateMany({ sessionId }, { $set: { userId: user._id.toString() } });

            const UserSession = require("../models/UserSession");
            await UserSession.findOneAndUpdate({ sessionId }, {
                $set: { userId: user._id.toString(), name: user.name, phone, verified: true }
            });

            // Trigger Memory Consolidation (phone = identity anchor for device-agnostic memory)
            const history = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();
            if (history.length > 0) {
                const formatted = history.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                }));
                consolidateChatToMemory(user._id.toString(), chatbotId, sessionId, formatted, phone)
                    .catch(err => console.error("Memory Error:", err));
            }
        }

        const tokenData = generateToken({ userId: user._id.toString(), phone, chatbotId });

        res.json({
            success: true,
            token: tokenData.token,
            userInfo: { phone, userId: user._id.toString(), name: user.name },
            expiresIn: tokenData.expiresIn
        });

    } catch (error) {
        console.error("❌ Verify Error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

// ... Keep existing routes ...
router.get("/check-session", async (req, res) => {
    try {
        const { phone, chatbotId } = req.query;
        if (!phone || !chatbotId) return res.status(400).json({ valid: false });
        const user = await PhoneUser.findOne({ phone, chatbotId, verified: true });
        res.json({ valid: !!user });
    } catch (err) { res.status(500).json({ valid: false }); }
});

router.get("/conversations", async (req, res) => {
    const { phone, chatbotId } = req.query;
    if (!phone || !chatbotId) return res.status(400).json({ success: false });
    try {
        const Chat = require("../models/Chat");
        const chats = await Chat.find({ phone, chatbotId }).sort({ lastMessageAt: -1 }).lean();
        const formatted = chats.map(c => ({
            id: c.conversationId, title: c.title || "Previous Chat", timestamp: c.lastMessageAt
        }));
        res.json({ success: true, conversations: formatted });
    } catch (e) { res.status(500).json({ success: false }); }
});

module.exports = router;