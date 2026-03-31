/**
 * Transcript Routes
 * 
 * Handle conversation transcript configuration and export
 * Endpoints:
 *   GET  /api/transcript/:chatbotId
 *   POST /api/transcript/send
 *   GET  /api/transcript/export/:sessionId
 */

const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const Message = require('../models/Message');
const UserSession = require('../models/UserSession');
const logger = require('../config/logging');

/**
 * GET /:chatbotId
 * Get transcript configuration
 */
router.get('/:chatbotId', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json({
      data: {
        enabled: chatbot.settings?.transcriptEnabled || false,
        inactivity_timeout_ms: chatbot.settings?.transcriptInactivityTimeout || 300000, // 5 minutes
        auto_send_on_inactivity: chatbot.settings?.transcriptAutoSend || false,
        send_to_email: chatbot.settings?.transcriptEmail || null,
        send_to_webhook: chatbot.settings?.transcriptWebhook || null,
        include_metadata: chatbot.settings?.transcriptIncludeMetadata || true,
      }
    });
  } catch (error) {
    logger.error('Transcript config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /send
 * Send transcript to configured destination
 */
router.post('/send', async (req, res) => {
  const { chatbotId, sessionId, email } = req.body;

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

    // Get conversation
    const messages = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    const session = await UserSession.findOne({ sessionId }).lean();

    // Format transcript
    const transcript = formatTranscript(messages, session, chatbot);

    // Determine destination
    const sendToEmail = email || chatbot.settings?.transcriptEmail;
    const sendToWebhook = chatbot.settings?.transcriptWebhook;

    // Send to email
    if (sendToEmail) {
      // TODO: Implement email sending
      // await sendEmail(sendToEmail, 'Chat Transcript', transcript);
      logger.info(`Transcript would be sent to: ${sendToEmail}`);
    }

    // Send to webhook
    if (sendToWebhook) {
      // TODO: Implement webhook
      // await axios.post(sendToWebhook, { transcript, session });
      logger.info(`Transcript would be sent to webhook: ${sendToWebhook}`);
    }

    res.json({
      success: true,
      message: 'Transcript sent',
      messageCount: messages.length,
    });

  } catch (error) {
    logger.error('Send transcript error:', error);
    res.status(500).json({ error: 'Failed to send transcript' });
  }
});

/**
 * GET /export/:sessionId
 * Export transcript as JSON/text
 */
router.get('/export/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { format = 'json', chatbotId } = req.query;

  try {
    const query = { sessionId };
    if (chatbotId) query.chatbotId = chatbotId;

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .lean();

    const session = await UserSession.findOne({ sessionId }).lean();

    if (format === 'text') {
      // Plain text format
      let text = `Chat Transcript\n`;
      text += `Session: ${sessionId}\n`;
      text += `Date: ${session?.startedAt || new Date()}\n`;
      text += `User: ${session?.name || 'Anonymous'}\n`;
      text += `\n---\n\n`;

      messages.forEach(m => {
        const role = m.role === 'user' ? 'User' : 'Assistant';
        const time = new Date(m.createdAt).toLocaleTimeString();
        text += `[${time}] ${role}: ${m.content}\n\n`;
      });

      res.set('Content-Type', 'text/plain');
      res.set('Content-Disposition', `attachment; filename="transcript-${sessionId}.txt"`);
      return res.send(text);
    }

    // JSON format (default)
    res.json({
      data: {
        session: {
          sessionId,
          startedAt: session?.startedAt,
          name: session?.name,
          phone: session?.phone,
          platform: session?.platform,
        },
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })),
        exportedAt: new Date(),
      }
    });

  } catch (error) {
    logger.error('Export transcript error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Format transcript for email/webhook
 */
function formatTranscript(messages, session, chatbot) {
  let text = `Chat Transcript - ${chatbot.name}\n`;
  text += `================================\n\n`;
  text += `Session ID: ${session?.sessionId}\n`;
  text += `User: ${session?.name || 'Anonymous'}\n`;
  text += `Phone: ${session?.phone || 'Not provided'}\n`;
  text += `Started: ${session?.startedAt || 'Unknown'}\n`;
  text += `Messages: ${messages.length}\n\n`;
  text += `---\n\n`;

  messages.forEach(m => {
    const role = m.role === 'user' ? '👤 User' : '🤖 Bot';
    const time = new Date(m.createdAt).toLocaleString();
    text += `${role} (${time}):\n${m.content}\n\n`;
  });

  return text;
}

module.exports = router;
