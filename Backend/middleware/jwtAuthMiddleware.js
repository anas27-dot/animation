const jwt = require('jsonwebtoken');
const logger = require('../config/logging');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('CRITICAL: JWT_SECRET is not defined in environment variables!');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be defined in production environment');
  }
}


function authenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('JWT authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Invalid token' });
  }
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = {
  authenticateJWT,
  generateToken,
};

