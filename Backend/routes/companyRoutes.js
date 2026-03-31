const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');

// Protected routes - require admin authentication (no extra rate limit)
router.use(authenticateJWT);

// Check if user is admin
router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
});

// Company routes
router.get('/', companyController.getAllCompanies);
router.get('/all', companyController.getAllCompaniesWithChatbots);

// Credit management routes (must be before /:id route to avoid conflicts)
router.get('/:id/credits', companyController.getCompanyCredits);
router.post('/:id/credits', companyController.assignCompanyCredits); // Set/assign credits
router.post('/:id/credits/add', companyController.addCompanyCredits); // Add credits
router.post('/:id/credits/remove', companyController.removeCompanyCredits); // Remove credits
router.get('/:id/credits/history', companyController.getCompanyCreditHistory);
router.get('/:id/password', companyController.getCompanyPassword);

router.get('/:id', companyController.getCompany);
router.post('/', companyController.createCompany);
router.post('/create', companyController.createCompany); // Alias for frontend compatibility
router.put('/:id', companyController.updateCompany);
router.put('/update/:id', companyController.updateCompany); // Alias for ManageChatbotUIPage compatibility
router.delete('/:id', companyController.deleteCompany);
router.delete('/delete/:id', companyController.deleteCompany); // Alias for frontend compatibility

module.exports = router;

