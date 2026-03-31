const Company = require('../models/Company');
const logger = require('../config/logging');

async function authenticateAPIKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const company = await Company.findOne({ apiKey, isActive: true });
    
    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.company = company;
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  authenticateAPIKey,
};

