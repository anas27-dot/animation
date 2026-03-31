const express = require('express');
const router = express.Router();
const leadCaptureController = require('../controllers/leadCaptureController');
const { authenticateAPIKey } = require('../middleware/authMiddleware');
const { generalLimiter } = require('../middleware/rateLimiter');

// Apply authentication and rate limiting
router.use(authenticateAPIKey);
router.use(generalLimiter);

// Lead capture endpoints
router.post('/capture', leadCaptureController.captureLead);
router.get('/:chatbotId', leadCaptureController.getLeads);
router.post('/export/:leadId', leadCaptureController.exportToCRM);

module.exports = router;

