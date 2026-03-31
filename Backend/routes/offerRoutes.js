const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');

// Apply authentication to all routes
router.use(authenticateJWT);

// Check if user is admin
router.use((req, res, next) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

// Offer sidebar configuration routes
router.get('/sidebar-config', offerController.getOfferSidebarConfig);
router.put('/sidebar-config', sensitiveLimiter, offerController.updateOfferSidebarConfig);

// Offer template routes
router.get('/', offerController.getOfferTemplates);
router.get('/:id', offerController.getOfferTemplate);
router.post('/', sensitiveLimiter, offerController.createOfferTemplate);
router.put('/:id', sensitiveLimiter, offerController.updateOfferTemplate);
router.delete('/:id', sensitiveLimiter, offerController.deleteOfferTemplate);

module.exports = router;
