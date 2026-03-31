const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { authenticateAPIKey } = require('../middleware/authMiddleware');
const logger = require('../config/logging');

/**
 * GET /:chatbotId
 * Get customization settings for a chatbot
 */
router.get('/:chatbotId', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json({
      success: true,
      data: {
        customization: chatbot.customization || {},
        settings: chatbot.settings || {},
      },
    });
  } catch (error) {
    logger.error('Get customization error:', error);
    res.status(500).json({ error: 'Failed to get customization' });
  }
});

/**
 * PUT /:chatbotId
 * Update customization settings
 */
router.put('/:chatbotId', authenticateAPIKey, async (req, res) => {
  try {
    const { customization, settings } = req.body;
    const chatbot = await Chatbot.findOne({
      _id: req.params.chatbotId,
      company: req.company._id,
    });

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    if (customization) {
      chatbot.customization = { ...chatbot.customization, ...customization };
    }
    if (settings) {
      chatbot.settings = { ...chatbot.settings, ...settings };
    }

    await chatbot.save();

    res.json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    logger.error('Update customization error:', error);
    res.status(500).json({ error: 'Failed to update customization' });
  }
});

/**
 * POST /:chatbotId/reset
 * Reset customization to defaults
 */
router.post('/:chatbotId/reset', authenticateAPIKey, async (req, res) => {
  try {
    const chatbot = await Chatbot.findOne({
      _id: req.params.chatbotId,
      company: req.company._id,
    });

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    chatbot.customization = {
      primaryColor: '#0066FF',
      fontFamily: 'Inter',
      position: 'bottom-right',
    };

    await chatbot.save();

    res.json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    logger.error('Reset customization error:', error);
    res.status(500).json({ error: 'Failed to reset customization' });
  }
});

module.exports = router;

