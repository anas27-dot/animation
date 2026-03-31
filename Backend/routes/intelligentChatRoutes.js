/**
 * Intelligent Chat Routes
 */
const express = require('express');
const router = express.Router();
const { chatLimiter } = require('../middleware/rateLimiter');
const { generateStreamingAnswer } = require('../services/chatService');
const SSEHelper = require('../utils/sseHelper');
const edgeTTSService = require('../services/edgeTTSService');
const Message = require('../models/Message');
const UserSession = require('../models/UserSession');
const Chatbot = require('../models/Chatbot');
const Chat = require('../models/Chat');
const logger = require('../config/logging');
const jwt = require('jsonwebtoken');
const { consolidateChatToMemory } = require('../services/memoryService');
const usageAlertService = require('../services/usageAlertService');

router.post('/stream', chatLimiter, async (req, res) => {
  const { chatbotId, query, sessionId: providedSessionId, conversationId, phone, name, email, enableTTS, voice, language } = req.body;

  if (!chatbotId || !query) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Required fields missing' });

  SSEHelper.setupSSEHeaders(res);

  try {
    const chatbot = await Chatbot.findById(chatbotId).populate('company');
    if (!chatbot || !chatbot.isActive) { SSEHelper.sendError(res, 'Chatbot unavailable'); return res.end(); }

    // Credits Check
    if (chatbot.company?.credits?.total !== undefined) {
      if (chatbot.company.credits.remaining < 2) {
        SSEHelper.sendError(res, { error: 'CREDITS_EXHAUSTED', message: 'Insufficient credits.' });
        return res.end();
      }
      chatbot.company.credits.used += 1;
      chatbot.company.credits.remaining -= 1;
      await chatbot.company.save();

      // 🔥 Real-time Usage Alert Check (Non-blocking)
      usageAlertService.checkCreditAlerts(chatbot.company).catch(err => logger.error('Alert Error:', err));
    }

    // Session Management
    const sessionId = providedSessionId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const effectiveConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let session = await UserSession.findOne({ sessionId });
    if (!session) {
      session = await UserSession.create({
        sessionId, chatbotId, phone, name, email, platform: 'web', language: language || 'English',
        messageCount: 0, startedAt: new Date(), lastActivityAt: new Date(),
        metadata: { userAgent: req.get('user-agent'), ipAddress: req.ip }
      });
    } else {
      // ✅ SYNC SESSION: Update session if new info provided in request
      let needsSave = false;
      if (phone && !session.phone) { session.phone = phone; needsSave = true; }
      if (name && !session.name) { session.name = name; needsSave = true; }
      if (email && !session.email) { session.email = email; needsSave = true; }

      if (needsSave) {
        console.log(`📝 [Session Sync] Updating info for session ${sessionId}:`, { phone: session.phone, name: session.name });
        await session.save();
      }
    }

    // ✅ NAME RECOVERY: If name is missing but we have a phone, try to fetch from other records
    if ((!session.name || session.name === 'Anonymous' || session.name === 'User') && session.phone) {
      try {
        const PhoneUser = require('../models/PhoneUser');
        const phoneUser = await PhoneUser.findOne({ phone: session.phone, chatbotId });

        if (phoneUser && phoneUser.name && phoneUser.name !== 'User') {
          console.log(`👤 [Name Recovery] Found name in PhoneUser: ${phoneUser.name}`);
          session.name = phoneUser.name;
          await session.save();
        } else {
          const LeadCapture = require('../models/LeadCapture');
          const lead = await LeadCapture.findOne({
            $or: [{ phone: session.phone }, ...(session.email ? [{ email: session.email }] : [])],
            chatbotId
          }).sort({ createdAt: -1 });

          if (lead && lead.name) {
            console.log(`👤 [Name Recovery] Found name in LeadCapture: ${lead.name}`);
            session.name = lead.name;
            await session.save();
          }
        }
      } catch (err) {
        logger.error('Error recovering user name:', err);
      }
    }

    // Auth & ID Logic
    let isUserVerified = session.verified === true;
    let jwtUserId = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
        if (decoded) {
          isUserVerified = true;
          jwtUserId = decoded.userId || decoded.id; // Correctly capture ID
          if (!session.verified) { session.verified = true; await session.save(); }
        }
      } catch (e) { logger.warn('JWT Failed:', e.message); }
    }

    // Teaser Mode
    const isAuthEnabled = chatbot.settings?.authentication?.isEnabled === true || chatbot.settings?.authentication?.isEnabled === 'true';
    if (isAuthEnabled && !isUserVerified && (session.messageCount + 1) > 1) {
      SSEHelper.sendError(res, { error: 'MESSAGE_LIMIT_REACHED', message: 'Free preview ended.' });
      return res.end();
    }

    SSEHelper.sendEvent(res, 'connected', { sessionId, conversationId: effectiveConversationId });

    // History
    const historyMessages = await Message.find({ conversationId: effectiveConversationId }).sort({ createdAt: -1 }).limit(20).lean();
    const history = historyMessages.reverse().map(msg => {
      let content = msg.content;
      try { if (typeof content === 'string' && content.startsWith('[')) content = JSON.parse(content); } catch (e) { }
      return { role: msg.role, content };
    });

    // Normalized phone for this message (from session or request body)
    const messagePhone = (session.phone || phone)
      ? String(session.phone || phone).replace(/\D/g, '')
      : undefined;

    const userMessage = await Message.create({
      sessionId,
      conversationId: effectiveConversationId,
      chatbotId,
      role: 'user',
      content: query,
      language,
      phone: messagePhone, // 👈 Stamp user message with phone
      createdAt: new Date()
    });

    session.messageCount += 1;
    session.lastActivityAt = new Date();
    await session.save();

    // 🛑 Greedy Identity Migration removed: guest messages stay guest-only; auth uses phone-only fetch

    const chat = await Chat.findOrCreateForSession({
      sessionId,
      conversationId: effectiveConversationId,
      chatbotId,
      userId: session.userId,
      phone: messagePhone // 📱 Resolved, normalized phone passed here
    });

    // 🚀 IDENTIFY USER ID (CRITICAL)
    // Priority: Session -> JWT -> Phone -> Guest
    const userId = session.userId || jwtUserId || req.body.phone || 'guest';

    logger.info(`🆔 [Identity] Using User ID for Memory: ${userId}`);

    userMessage.chatId = chat._id;
    await userMessage.save();

    const startTime = Date.now();
    let fullResponse = '';
    let tokenCount = 0;

    // 🚀 GENERATE RESPONSE (Correct Argument Order) — pass messagePhone for device-agnostic memory retrieval
    for await (const event of generateStreamingAnswer(
      query,
      chatbotId,
      userId, // ✅ PASSED 3rd
      history,
      { phone: messagePhone || phone, name, email, language }
    )) {
      if (event.type === 'text') {
        fullResponse += event.data;
        SSEHelper.sendEvent(res, 'text', { content: event.data });
      } else if (event.type.includes('_intent_detected')) {
        SSEHelper.sendEvent(res, event.type, event.data);
      } else if (event.type === 'error') {
        SSEHelper.sendError(res, event.error);
        break;
      } else if (event.type === 'complete') {
        tokenCount = event.tokens?.total || 0;
      }
    }

    // Post Processing
    const cleanedResponse = fullResponse.replace(/\[SUGGESTIONS?\][\s\S]*$/gi, '').trim();
    const suggestions = extractSuggestions(fullResponse);

    if (enableTTS && cleanedResponse) {
      try {
        const audio = await edgeTTSService.generateSpeech(cleanedResponse, voice || 'en-US-JennyNeural');
        if (audio) SSEHelper.sendAudioChunk(res, audio.toString('base64'), 0);
      } catch (e) { }
    }

    if (suggestions.length) SSEHelper.sendEvent(res, 'suggestions', { suggestions });

    await Message.create({
      sessionId,
      conversationId: effectiveConversationId,
      chatId: chat._id,
      chatbotId,
      role: 'assistant',
      content: cleanedResponse,
      language,
      tokens: tokenCount,
      phone: messagePhone, // 👈 Stamp assistant message with phone too
      createdAt: new Date()
    });

    await chat.updateStats();

    if (chatbot.company?.credits?.total !== undefined) {
      chatbot.company.credits.used += 1;
      chatbot.company.credits.remaining -= 1;
      await chatbot.company.save();

      // 🔥 Real-time Usage Alert Check (Non-blocking)
      usageAlertService.checkCreditAlerts(chatbot.company).catch(err => logger.error('Alert Error:', err));
    }

    SSEHelper.sendEvent(res, 'done', { fullAnswer: cleanedResponse, sessionId });

    // 🚀 MEMORY CONSOLIDATION (pass messagePhone so Identity Anchor is phone when authenticated)
    if (userId && userId !== 'guest') {
      const fullHistory = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();
      const formatted = fullHistory.map(m => ({ role: m.role, content: m.content }));
      consolidateChatToMemory(userId, chatbotId, sessionId, formatted, messagePhone)
        .catch(err => console.error("Memory Error:", err.message));
    }

    res.end();

  } catch (error) {
    logger.error('Stream error:', error);
    SSEHelper.sendError(res, { error: 'STREAM_ERROR', message: error.message });
    res.end();
  }
});

function extractSuggestions(text) {
  const m = text.match(/\[SUGGESTIONS?:\s*([^\]]+)\]/i);
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean).slice(0, 4) : [];
}

module.exports = router;