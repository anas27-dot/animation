const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const Company = require('../models/Company');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logging');

// Protected routes - require admin authentication
router.use(authenticateJWT);
router.use(sensitiveLimiter);

// Check if user is admin
router.use((req, res, next) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

/**
 * GET /subscriptions
 * Get all chatbot subscriptions (admin view)
 */
router.get('/', async (req, res) => {
  try {
    const chatbots = await Chatbot.find({ isActive: true })
      .populate('company', 'name apiKey')
      .sort({ createdAt: -1 });

    // Format as subscriptions for frontend compatibility
    const subscriptions = chatbots.map(chatbot => ({
      chatbot_id: {
        _id: chatbot._id,
        name: chatbot.name,
        company_id: chatbot.company._id,
        company: chatbot.company,
        isActive: chatbot.isActive,
        settings: chatbot.settings,
        createdAt: chatbot.createdAt,
      },
      // Mock subscription data (you can add real subscription model later)
      plan_name: 'Basic',
      status: chatbot.isActive ? 'active' : 'inactive',
      start_date: chatbot.createdAt,
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from creation
    }));

    res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    logger.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

module.exports = router;

