const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { authenticateAPIKey } = require('../middleware/authMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const Chatbot = require('../models/Chatbot');
const logger = require('../config/logging');

// Middleware that accepts either JWT or API key
const authenticateFlexible = async (req, res, next) => {
  // Try JWT first (for admin dashboard)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET;
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      if (req.user.type === 'admin' || req.user.type === 'user') {
        return next();
      }
    } catch (err) {
      // JWT failed, try API key
    }
  }

  // Try API key (for company API calls)
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'Authentication required (API key or JWT token)' });
    }
    const Company = require('../models/Company');
    const company = await Company.findOne({ apiKey, isActive: true });
    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.company = company;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

router.use(authenticateFlexible);
router.use(sensitiveLimiter);

/**
 * GET /suggestions/:chatbotId
 * Get UI suggestions for a chatbot
 */
router.get('/:chatbotId', async (req, res) => {
  try {
    const { chatbotId } = req.params;

    // Verify chatbot exists and user has access
    let query = { _id: chatbotId };
    if (req.company) {
      query.company = req.company._id;
    } else if (req.user?.type === 'user' && req.user.companyId) {
      query.company = req.user.companyId;
    }

    const chatbot = await Chatbot.findOne(query);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Get suggestions from chatbot settings
    const suggestions = chatbot.settings?.uiSuggestions || chatbot.settings?.suggestions || [];

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    logger.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * POST /suggestions/:chatbotId
 * Create or update UI suggestions for a chatbot (upsert)
 */
router.post('/:chatbotId', async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const { suggestions } = req.body;

    if (!Array.isArray(suggestions)) {
      return res.status(400).json({ error: 'Suggestions must be an array' });
    }

    // Verify chatbot exists and user has access
    let query = { _id: chatbotId };
    if (req.company) {
      query.company = req.company._id;
    } else if (req.user?.type === 'user' && req.user.companyId) {
      query.company = req.user.companyId;
    } else if (req.user?.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chatbot = await Chatbot.findOne(query);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update suggestions in settings
    if (!chatbot.settings) {
      chatbot.settings = {};
    }
    chatbot.settings.uiSuggestions = suggestions;
    chatbot.settings.suggestions = suggestions; // Keep both for compatibility
    await chatbot.save();

    res.json({
      success: true,
      data: suggestions,
      message: 'Suggestions saved successfully',
    });
  } catch (error) {
    logger.error('Save suggestions error:', error);
    res.status(500).json({ error: 'Failed to save suggestions' });
  }
});

/**
 * PUT /suggestions/:chatbotId
 * Update existing UI suggestions for a chatbot
 */
router.put('/:chatbotId', async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const { suggestions } = req.body;

    if (!Array.isArray(suggestions)) {
      return res.status(400).json({ error: 'Suggestions must be an array' });
    }

    // Verify chatbot exists and user has access
    let query = { _id: chatbotId };
    if (req.company) {
      query.company = req.company._id;
    } else if (req.user?.type === 'user' && req.user.companyId) {
      query.company = req.user.companyId;
    } else if (req.user?.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chatbot = await Chatbot.findOne(query);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Update suggestions in settings
    if (!chatbot.settings) {
      chatbot.settings = {};
    }
    chatbot.settings.uiSuggestions = suggestions;
    chatbot.settings.suggestions = suggestions; // Keep both for compatibility
    await chatbot.save();

    res.json({
      success: true,
      data: suggestions,
      message: 'Suggestions updated successfully',
    });
  } catch (error) {
    logger.error('Update suggestions error:', error);
    res.status(500).json({ error: 'Failed to update suggestions' });
  }
});

module.exports = router;

