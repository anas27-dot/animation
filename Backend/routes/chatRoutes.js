const express = require('express');
const router = express.Router();
const messageController = require('../controllers/chat/messageController');
const suggestionController = require('../controllers/suggestionController');
const { chatLimiter } = require('../middleware/rateLimiter');

// Rate limiting only; CORS handled by app-level chatCors (allow all for chat)
router.use(chatLimiter);

// Autocomplete suggestions (KB + popular + personal + context)
router.get('/suggestions', suggestionController.getSuggestions);
router.post('/suggestions/record', suggestionController.recordQuery);
router.post('/suggestions/reseed-kb/:chatbotId', suggestionController.reseedKbSuggestions);

// Conversation management endpoints
router.post('/conversation', messageController.createConversation);
router.get('/conversations/:sessionId', messageController.getConversations);
router.get('/messages/:conversationId', messageController.getConversationMessages);
router.post('/messages', messageController.saveMessages);

// Chat endpoints
router.post('/streaming', messageController.streamChatMessage);
router.get('/history/:sessionId', messageController.getChatHistory);
router.post('/feedback', messageController.submitFeedback);
router.post('/classify', messageController.classifyMessage);
router.post('/translate', messageController.translateMessage);

module.exports = router;

