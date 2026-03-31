const express = require('express');
const router = express.Router();
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
 * GET /plans
 * Get available subscription plans
 */
router.get('/', async (req, res) => {
  try {
    // Mock plans data (you can create a Plan model later)
    const plans = [
      {
        _id: 'plan_basic',
        name: 'Basic Plan',
        price: 0,
        credits: 1000,
        duration_days: 30,
        features: ['Basic chatbot', 'Email support'],
      },
      {
        _id: 'plan_pro',
        name: 'Pro Plan',
        price: 999,
        credits: 10000,
        duration_days: 30,
        features: ['Advanced chatbot', 'Priority support', 'Custom branding'],
      },
      {
        _id: 'plan_enterprise',
        name: 'Enterprise Plan',
        price: 4999,
        credits: 100000,
        duration_days: 30,
        features: ['Unlimited chatbots', '24/7 support', 'Custom integrations', 'Dedicated account manager'],
      },
    ];

    res.json({
      success: true,
      plans,
    });
  } catch (error) {
    logger.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

module.exports = router;

