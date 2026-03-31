/**
 * Handoff Routes
 * 
 * Handle human agent handoff requests
 * Endpoints:
 *   GET  /api/handoff/config/:chatbotId
 *   POST /api/handoff/request
 *   GET  /api/handoff/messages/:sessionId
 *   POST /api/handoff/agent-reply
 */

const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const Message = require('../models/Message');
const UserSession = require('../models/UserSession');
const logger = require('../config/logging');

// Handoff session store (use Redis/MongoDB in production)
const handoffSessions = new Map();

/**
 * GET /config/:chatbotId
 * Get handoff configuration
 */
router.get('/config/:chatbotId', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json({
      data: {
        enabled: chatbot.settings?.handoffEnabled || false,
        keywords: chatbot.settings?.handoffKeywords || [
          'human', 'agent', 'talk to someone', 'speak to person',
          'customer support', 'live chat', 'real person', 'representative'
        ],
        confirmation_prompt_text: chatbot.settings?.handoffConfirmationText ||
          "I can connect you with a human agent. Would you like me to proceed?",
        success_message: chatbot.settings?.handoffSuccessMessage ||
          "I'm connecting you to a human agent. Please wait a moment.",
        toast_message: chatbot.settings?.handoffToastMessage ||
          "Handoff request sent to our team",
        positive_responses: ['yes', 'ok', 'sure', 'please', 'connect me', 'talk to human'],
        negative_responses: ['no', 'not now', 'later', 'cancel', 'nevermind'],
        timeout_minutes: chatbot.settings?.handoffTimeout || 5,
        working_hours: chatbot.settings?.handoffWorkingHours || {
          enabled: false,
          start: '09:00',
          end: '18:00',
          timezone: 'Asia/Kolkata',
          offline_message: "Our agents are currently offline. Please leave a message and we'll get back to you.",
        },
      }
    });
  } catch (error) {
    logger.error('Handoff config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /request
 * Create a handoff request
 */
router.post('/request', async (req, res) => {
  const { chatbotId, sessionId, phone, name, message } = req.body;

  if (!chatbotId || !sessionId) {
    return res.status(400).json({
      error: 'chatbotId and sessionId are required'
    });
  }

  try {
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Get session
    const session = await UserSession.findOne({ sessionId });
    
    // Create handoff record
    const handoffId = `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const handoffData = {
      handoffId,
      chatbotId,
      sessionId,
      phone: phone || session?.phone || null,
      name: name || session?.name || 'Anonymous',
      message: message || 'User requested human agent',
      status: 'pending', // pending, assigned, resolved, cancelled
      createdAt: new Date(),
      assignedTo: null,
      resolvedAt: null,
    };

    // Store handoff session
    handoffSessions.set(handoffId, handoffData);

    // Get conversation history for context
    const history = await Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // TODO: Notify agents via webhook, email, or push notification
    // await notifyAgents(handoffData, history);

    logger.info(`Handoff requested: ${handoffId} for session ${sessionId}`);

    // Update session
    if (session) {
      session.handoffRequested = true;
      session.handoffId = handoffId;
      await session.save();
    }

    res.json({
      success: true,
      message: 'Handoff request submitted',
      handoffId,
      status: 'pending',
      estimatedWait: '2-5 minutes',
    });

  } catch (error) {
    logger.error('Handoff request error:', error);
    res.status(500).json({ error: 'Failed to create handoff request' });
  }
});

/**
 * GET /messages/:sessionId
 * Get handoff session messages (for agent dashboard)
 */
router.get('/messages/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { chatbotId } = req.query;

  try {
    // Get conversation history
    const query = { sessionId };
    if (chatbotId) query.chatbotId = chatbotId;

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .lean();

    // Get session info
    const session = await UserSession.findOne({ sessionId }).lean();

    res.json({
      data: {
        session: {
          sessionId,
          phone: session?.phone || null,
          name: session?.name || 'Anonymous',
          platform: session?.platform || 'web',
          startedAt: session?.startedAt,
        },
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
        messageCount: messages.length,
      }
    });

  } catch (error) {
    logger.error('Get handoff messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /agent-reply
 * Agent sends reply to user
 */
router.post('/agent-reply', async (req, res) => {
  const { handoffId, sessionId, message, agentName } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({
      error: 'sessionId and message are required'
    });
  }

  try {
    // Save agent message
    const session = await UserSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Message.create({
      sessionId,
      chatbotId: session.chatbotId,
      role: 'assistant',
      content: message,
      isAgentMessage: true,
      agentName: agentName || 'Support Agent',
      createdAt: new Date(),
    });

    // TODO: Send message to user via SSE/WebSocket/Push
    
    res.json({
      success: true,
      message: 'Reply sent',
    });

  } catch (error) {
    logger.error('Agent reply error:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

/**
 * GET /active
 * Get active handoff sessions (for user dashboard)
 */
router.get('/active', async (req, res) => {
  try {
    const { chatbotId, status = 'pending' } = req.query;
    
    // Convert Map to Array
    const allHandoffs = Array.from(handoffSessions.values());
    
    // Filter by chatbotId and status
    let filteredHandoffs = allHandoffs.filter(h => {
      if (chatbotId && h.chatbotId !== chatbotId) return false;
      if (status && h.status !== status) return false;
      return h.status === 'pending' || h.status === 'assigned';
    });

    // Get session details
    const handoffsWithDetails = await Promise.all(
      filteredHandoffs.map(async (handoff) => {
        const session = await UserSession.findOne({ sessionId: handoff.sessionId }).lean();
        const messageCount = await Message.countDocuments({ sessionId: handoff.sessionId });
        
        return {
          handoffId: handoff.handoffId,
          sessionId: handoff.sessionId,
          chatbotId: handoff.chatbotId,
          phone: handoff.phone || session?.phone,
          name: handoff.name,
          message: handoff.message,
          status: handoff.status,
          createdAt: handoff.createdAt,
          assignedTo: handoff.assignedTo,
          messageCount,
        };
      })
    );

    res.json({
      success: true,
      data: handoffsWithDetails,
    });
  } catch (error) {
    logger.error('Get active handoffs error:', error);
    res.status(500).json({ error: 'Failed to get active handoffs' });
  }
});

/**
 * POST /approve
 * Approve a pending handoff session
 */
router.post('/approve', async (req, res) => {
  const { sessionId, agentId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    // Find handoff by sessionId
    const handoffs = Array.from(handoffSessions.values());
    const handoff = handoffs.find(h => h.sessionId === sessionId && h.status === 'pending');
    
    if (!handoff) {
      return res.status(404).json({ error: 'Pending handoff not found' });
    }

    handoff.status = 'assigned';
    handoff.assignedTo = agentId || 'agent';
    handoff.assignedAt = new Date();
    handoffSessions.set(handoff.handoffId, handoff);

    res.json({
      success: true,
      handoffId: handoff.handoffId,
      status: 'assigned',
    });
  } catch (error) {
    logger.error('Approve handoff error:', error);
    res.status(500).json({ error: 'Failed to approve handoff' });
  }
});

/**
 * POST /send-message
 * Send a message from agent to user
 */
router.post('/send-message', async (req, res) => {
  const { sessionId, message, agentId } = req.body;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    const session = await UserSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await Message.create({
      sessionId,
      chatbotId: session.chatbotId,
      role: 'assistant',
      content: message,
      isAgentMessage: true,
      agentId: agentId || 'agent',
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Message sent',
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /resolve
 * Mark handoff as resolved
 */
router.post('/resolve', async (req, res) => {
  const { handoffId, resolution } = req.body;

  if (!handoffId) {
    return res.status(400).json({ error: 'handoffId is required' });
  }

  try {
    const handoff = handoffSessions.get(handoffId);
    if (!handoff) {
      return res.status(404).json({ error: 'Handoff session not found' });
    }

    handoff.status = 'resolved';
    handoff.resolvedAt = new Date();
    handoff.resolution = resolution || 'Resolved by agent';
    handoffSessions.set(handoffId, handoff);

    // Update user session
    await UserSession.findOneAndUpdate(
      { sessionId: handoff.sessionId },
      { handoffResolved: true }
    );

    res.json({
      success: true,
      message: 'Handoff resolved',
    });

  } catch (error) {
    logger.error('Resolve handoff error:', error);
    res.status(500).json({ error: 'Failed to resolve handoff' });
  }
});

module.exports = router;
