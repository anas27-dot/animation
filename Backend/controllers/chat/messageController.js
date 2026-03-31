const chatService = require('../../services/chatService');
const streamingResponseService = require('../../services/streamingResponseService');
const Message = require('../../models/Message');
const UserSession = require('../../models/UserSession');
const Chatbot = require('../../models/Chatbot');
const redisSessionManager = require('../../services/redisSessionManager');
const Chat = require('../../models/Chat'); // Import Chat model
const logger = require('../../config/logging');

// Conversation Management Functions
async function createConversation(req, res) {
  try {
    const {
      sessionId,
      title = 'New Conversation',
      chatbotId,
      phone,
      isInitialization = false
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    // Generate unique conversation ID
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save to Chat collection so it persists on refresh
    const now = new Date();
    const newChat = new Chat({
      sessionId,
      conversationId,
      chatbotId,
      phone,
      title,
      preview: '',
      lastMessageAt: now,
      messageCount: 0,
      createdAt: now,
      updatedAt: now
    });

    const savedChat = await newChat.save();
    logger.info('✅ Chat saved to DB:', {
      _id: savedChat._id,
      sessionId: savedChat.sessionId,
      conversationId: savedChat.conversationId
    });

    logger.info('New conversation created and saved', {
      sessionId,
      conversationId,
      title,
      isInitialization
    });

    res.json({
      success: true,
      conversationId,
      title,
      created: true
    });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
}

async function getConversations(req, res) {
  try {
    const { sessionId } = req.params;
    const { search } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    logger.info('Fetching chats for sessionId:', sessionId);

    // Build query for Chat (Materialized View)
    // 🎯 Enforce chatbotId filtering to prevent cross-bot history leakage
    const chatbotId = req.get('x-chatbot-id') || req.body.chatbotId || req.query.chatbotId;

    let chatQuery = { sessionId };
    if (chatbotId) {
      chatQuery.chatbotId = chatbotId;
    }

    // If phone is provided (authenticated user), allow finding chats by phone too
    const { phone } = req.query;
    if (phone) {
      const normalizedPhone = String(phone).replace(/\D/g, '');
      chatQuery = {
        chatbotId: chatbotId, // 🚀 CRITICAL: Always isolate by bot
        $or: [
          { sessionId },
          { phone: normalizedPhone }
        ]
      };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const baseQuery = chatQuery; // Preserve base session/phone/bot filter
      chatQuery = {
        $and: [
          baseQuery,
          {
            $or: [
              { title: { $regex: searchRegex } },
              { preview: { $regex: searchRegex } },
              { phone: { $regex: searchRegex } }
            ]
          }
        ]
      };
    }

    // Get chats from Materialized View (O(1) search)
    const chats = await Chat.find(chatQuery)
      .sort({ lastMessageAt: -1 })
      .lean();
    logger.info('Query for chats:', JSON.stringify(chatQuery));
    logger.info('Found chats count:', chats.length);
    if (chats.length > 0) {
      logger.info('First chat:', JSON.stringify(chats[0]));
    }

    // Format for frontend
    const conversations = chats.map((chat) => ({
      id: chat.conversationId || chat.sessionId,
      initials: 'TT',
      title: chat.title || 'New Conversation',
      preview: chat.preview || '',
      time: new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: chat.lastMessageAt,
      unread: false,
    }));

    // If no conversations exist and not searching, return a default
    if (conversations.length === 0 && !search) {
      conversations.push({
        id: `default_${sessionId}`,
        initials: 'TT',
        title: 'Active Chat',
        preview: '',
        time: 'Now',
        unread: false,
      });
    }

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
}

async function getConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;

    logger.info('🔍 Getting messages for conversation:', conversationId);

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }

    // Find messages for this conversation - Optimized for strict conversationId
    const messages = await Message.find({
      conversationId: conversationId
    }).sort({ createdAt: 1, _id: 1 });

    logger.info(`📊 Found ${messages.length} messages for conversation ${conversationId}`);

    // Format messages for frontend
    const formattedMessages = messages.map(msg => {
      // Handle Vision API content stored as JSON strings or direct arrays/objects
      let displayContent = msg.content;
      let displayText = msg.content;
      let hasImage = false;
      let parsedContent = msg.content;

      // Check if content is a JSON string (stored Vision API format)
      if (typeof msg.content === 'string' && msg.content.trim().startsWith('[')) {
        try {
          parsedContent = JSON.parse(msg.content);
        } catch (e) {
          // If parsing fails, treat as regular string
          parsedContent = msg.content;
        }
      }

      // Now handle the parsed content (could be array, object, or string)
      if (Array.isArray(parsedContent)) {
        // Vision API format: [{ type: "text", text: ... }, { type: "image_url", image_url: { url: ... } }]
        const textPart = parsedContent.find(item => item.type === 'text');
        const imagePart = parsedContent.find(item => item.type === 'image_url');

        displayContent = textPart ? textPart.text : 'Image analysis';
        displayText = displayContent;
        hasImage = !!imagePart;
      } else if (typeof parsedContent === 'object' && parsedContent !== null) {
        // Handle other object formats if needed
        displayContent = parsedContent.text || parsedContent.content || 'Content';
        displayText = displayContent;
      } else {
        // Regular string content
        displayContent = parsedContent;
        displayText = parsedContent;
      }

      return {
        id: msg._id.toString(),
        content: displayContent,
        isUser: msg.role === 'user',
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: msg.createdAt, // Return full timestamp for frontend
        model: msg.model || 'gpt-4o-mini',
        tags: msg.tags || [],
        responses: msg.responses || [{
          id: `resp_${msg._id}_${Date.now()}`,
          text: displayText,
          timestamp: msg.createdAt
        }],
        activeResponseIndex: 0,
        type: msg.type || null,
        chart: msg.chart || null,
        hasImage: hasImage,
        originalContent: msg.content // Keep original for debugging if needed
      };
    });

    res.json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    logger.error('Get conversation messages error:', error);
    res.status(500).json({ error: 'Failed to get conversation messages' });
  }
}

async function streamChatMessage(req, res) {
  try {
    const { message, sessionId, chatbotId, conversationId } = req.body;

    logger.info('💬 Streaming chat message:', {
      message: message?.substring(0, 50),
      sessionId,
      conversationId,
      hasConversationId: !!conversationId
    });

    // Validation
    if (!message || !sessionId || !chatbotId) {
      return res.status(400).json({
        error: 'Missing required fields: message, sessionId, chatbotId',
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: 'Message too long (max 4000 characters)',
      });
    }

    // Get or create session
    let session = await UserSession.findOne({ sessionId });
    if (!session) {
      session = new UserSession({
        sessionId,
        chatbotId,
        userId: req.body.userId,
        platform: req.body.platform || 'web',
        metadata: {
          userAgent: req.get('user-agent'),
          ipAddress: req.ip,
          referrer: req.get('referer'),
        },
      });
      await session.save();
    } else {
      session.lastActivityAt = new Date();
      await session.save();
    }

    // 🛑 Greedy Identity Migration removed: guest messages stay guest-only; auth uses phone-only fetch

    // 1. 🎯 Normalize identity anchor immediately (ensures phone-centric queries match)
    const normalizedPhone = session.phone ? String(session.phone).replace(/\D/g, '') : undefined;

    // Get conversation history - use conversationId if provided, otherwise fallback to sessionId
    const historyQuery = conversationId && conversationId !== 'undefined' && conversationId !== 'null'
      ? {
        $or: [
          { conversationId: String(conversationId) },
          { sessionId: String(sessionId) }
        ]
      }
      : { sessionId: String(sessionId) };

    logger.info('🔍 [History Query]', { conversationId, sessionId, historyQuery });
    const history = await Message.find(historyQuery)
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    logger.info('🔍 [History] Retrieved messages:', {
      query: historyQuery,
      count: history.length,
      messages: history.map(m => ({
        role: m.role,
        content: m.content?.substring(0, 100),
        createdAt: m.createdAt
      }))
    });

    // Save user message
    // Handle Vision API content (arrays/objects) by JSON stringifying for MongoDB storage
    let contentToSave = message;
    if (Array.isArray(message) || (typeof message === 'object' && message !== null)) {
      contentToSave = JSON.stringify(message);
    }

    // Ensure we don't save "undefined" as string
    const cleanConversationId = conversationId && conversationId !== 'undefined' && conversationId !== 'null'
      ? String(conversationId)
      : null;

    // 🚀 FIND OR CREATE CHAT (Sidebar History)
    const chat = await Chat.findOrCreateForSession({
      sessionId,
      conversationId: cleanConversationId,
      chatbotId,
      userId: session.userId,
      phone: normalizedPhone
    });

    // 🎯 Force the chat to adopt the phone if it's missing (migrate old guest chat to identity)
    if (normalizedPhone && !chat.phone) {
      chat.phone = normalizedPhone;
      await chat.save();
    }

    const userMessage = new Message({
      sessionId,
      conversationId: cleanConversationId,
      chatbotId,
      role: 'user',
      content: contentToSave,
      chatId: chat._id, // Link to chat
      phone: normalizedPhone,
      email: session.email,
      name: session.name,
    });
    await userMessage.save();

    logger.info('💾 User message saved:', {
      id: userMessage._id,
      conversationId: userMessage.conversationId,
      sessionId: userMessage.sessionId
    });

    // Update session message count
    session.messageCount += 1;
    await session.save();

    // Generate streaming response
    logger.info('📞 [MessageController] Calling chatService.generateStreamingAnswer');
    // 🚀 FIXED ARGUMENT ORDER: query, chatbotId, userId, history, options
    const responseGenerator = chatService.generateStreamingAnswer(
      message,
      chatbotId,
      session.userId || 'guest', // userId is 3rd
      history.map((m) => ({ role: m.role, content: m.content })), // history is 4th
      { phone: normalizedPhone, name: session.name, email: session.email } // options is 5th
    );
    logger.info('✅ [MessageController] Got responseGenerator from chatService');

    let fullResponse = '';
    let tokens = null;

    // Stream response
    logger.info('📤 [MessageController] Calling streamingResponseService.streamResponse');
    await streamingResponseService.streamResponse({
      responseGenerator: async function* () {
        logger.info('🔄 [MessageController] Generator function called - starting to consume responseGenerator');
        try {
          let eventCount = 0;
          for await (const event of responseGenerator) {
            eventCount++;
            logger.info(`📦 [MessageController] Event #${eventCount} received:`, event.type);
            logger.info('📦 [MessageController] Event received:', event.type);
            if (event.type === 'proposal_intent_detected') {
              logger.info('✅ [MessageController] proposal_intent_detected event - passing through');
              logger.info('📋 [MessageController] Event data:', JSON.stringify(event.data, null, 2));
              yield event;
            } else if (event.type === 'text') {
              fullResponse += event.data;
              yield event;
            } else if (event.type === 'complete') {
              tokens = event.tokens;
              yield event;
            } else {
              logger.info('📦 [MessageController] Other event type:', event.type);
              yield event;
            }
          }
          logger.info('✅ [MessageController] Finished consuming responseGenerator');
        } catch (error) {
          logger.error('❌ [MessageController] Error consuming responseGenerator:', error);
          throw error;
        }
      },
      res,
      options: {
        enableTTS: false, // Can be enabled based on chatbot settings
      },
    });

    // Save assistant message
    if (fullResponse) {
      // Assistant responses are typically strings, but ensure they're properly handled
      let assistantContentToSave = fullResponse;
      if (Array.isArray(fullResponse) || (typeof fullResponse === 'object' && fullResponse !== null)) {
        assistantContentToSave = JSON.stringify(fullResponse);
      }

      const assistantMessage = new Message({
        sessionId,
        conversationId: cleanConversationId,
        chatbotId,
        role: 'assistant',
        content: assistantContentToSave,
        chatId: chat._id, // Link to chat
        tokens: tokens?.total || 0,
        phone: normalizedPhone,
        email: session.email,
        name: session.name,
      });
      await assistantMessage.save();

      // 🚀 UPDATE CHAT STATS (Sidebar Preview)
      await chat.updateStats();

      logger.info('🤖 Assistant message saved:', {
        id: assistantMessage._id,
        conversationId: assistantMessage.conversationId,
        sessionId: assistantMessage.sessionId,
        contentLength: fullResponse.length
      });
    }
  } catch (error) {
    logger.error('Stream chat message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  }
}

async function getChatHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json({ messages });
  } catch (error) {
    logger.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
}

async function submitFeedback(req, res) {
  try {
    const { messageId, feedback, rating } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId required' });
    }

    // Update message with feedback
    await Message.findByIdAndUpdate(messageId, {
      feedback,
      rating,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}

async function saveMessages(req, res) {
  try {
    const { conversationId, messages, sessionId: bodySessionId, chatbotId: bodyChatbotId, phone } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }

    // Update session with phone if provided
    if (phone && bodySessionId) {
      await UserSession.findOneAndUpdate(
        { sessionId: bodySessionId },
        { $set: { phone } },
        { upsert: false }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    logger.info('💾 Saving messages for conversation:', {
      conversationId,
      messageCount: messages.length
    });

    // Try to find chatbotId and sessionId if not provided
    let chatbotId = bodyChatbotId;
    let sessionId = bodySessionId;

    if (!chatbotId || !sessionId) {
      const existingMsg = await Message.findOne({ conversationId });
      if (existingMsg) {
        chatbotId = chatbotId || existingMsg.chatbotId;
        sessionId = sessionId || existingMsg.sessionId;
      }
    }

    // If still missing chatbotId, look for any chatbot
    if (!chatbotId) {
      const anyChatbot = await Chatbot.findOne({ isActive: true });
      if (anyChatbot) chatbotId = anyChatbot._id;
    }

    // Insert new messages
    // Note: We need to map frontend message format to backend Message model
    const now = Date.now();
    const messagesToInsert = messages.map((msg, index) => {
      // Create a valid date. Add a small offset (index * 10ms) to ensure unique, sequential timestamps
      // This preserves the exact order even if they were saved in the same millisecond.
      let messageDate = new Date(now + (index * 10));

      if (msg.timestamp) {
        const parsedDate = new Date(msg.timestamp);
        if (!isNaN(parsedDate.getTime())) {
          // If we have a timestamp but multiple messages have the same one, 
          // we still add the index offset to preserve array order
          messageDate = new Date(parsedDate.getTime() + index);
        }
      }

      const normalizedPhone = (phone || msg.phone) ? String(phone || msg.phone).replace(/\D/g, '') : undefined;
      return {
        sessionId: msg.sessionId || sessionId || 'session_bulk_save',
        conversationId: String(conversationId),
        chatbotId: msg.chatbotId || chatbotId,
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.content || (msg.responses && msg.responses[0]?.text) || (msg.text) || '',
        phone: normalizedPhone, // 👈 Ensure phone from req.body is applied
        createdAt: messageDate,
      };
    });

    // Filter out invalid messages (must have content and chatbotId)
    const validMessages = messagesToInsert.filter(m => m.content && m.chatbotId);

    if (validMessages.length > 0) {
      // Option: Overwrite existing messages for this conversation
      await Message.deleteMany({ conversationId });

      await Message.insertMany(validMessages);
      logger.info(`✅ Successfully saved ${validMessages.length} messages for conversation ${conversationId}`);
    }

    res.json({
      success: true,
      message: 'Messages saved successfully'
    });
  } catch (error) {
    logger.error('Save messages error:', error);
    res.status(500).json({ error: 'Failed to save messages' });
  }
}

async function classifyMessage(req, res) {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const result = await chatService.classifyConfirmation(message);
    res.json(result);
  } catch (error) {
    logger.error('Classify message error:', error);
    res.status(500).json({ error: 'Failed to classify message' });
  }
}

async function translateMessage(req, res) {
  try {
    const { text, targetLanguage, targetScript } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'text and targetLanguage required' });
    }

    const languageService = require('../../services/languageService');
    const translatedText = await languageService.translateText(text, targetLanguage, targetScript || 'Latin');
    res.json({ translatedText });
  } catch (error) {
    logger.error('Translate message error:', error);
    res.status(500).json({ error: 'Failed to translate message' });
  }
}

module.exports = {
  createConversation,
  getConversations,
  getConversationMessages,
  saveMessages,
  streamChatMessage,
  getChatHistory,
  submitFeedback,
  classifyMessage,
  translateMessage,
};

