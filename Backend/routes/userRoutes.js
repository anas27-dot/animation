const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');

// Public routes (no rate limit)
router.post('/login', userController.login);
router.post('/logout', authenticateJWT, userController.logout);

// Customer verification - public endpoint for frontend widget
router.post('/customers/verify-public', userController.verifyCustomerNoAuth);

// Protected routes - require JWT authentication
router.use(authenticateJWT);

// Check if user is a regular user (not admin)
router.use((req, res, next) => {
  if (req.user.type !== 'user') {
    return res.status(403).json({ error: 'User access required' });
  }
  next();
});

// User routes
router.get('/company', userController.getCompany);
router.get('/plan', userController.getUserPlan);
router.get('/usage', userController.getUserUsage);
router.get('/dashboard-sidebar', userController.getDashboardSidebarConfig);
router.get('/analytics', userController.getAnalytics);
router.get('/sessions', userController.getSessions);
router.get('/chat-history', userController.getChatHistory);
router.get('/conversations', userController.getChatConversations);
router.get('/messages', userController.getMessages);
router.get('/contacts', userController.getContacts);
router.get('/customers', userController.getCustomers);
router.post('/customers/test-data', userController.createTestCustomers);
router.post('/customers/verify', userController.verifyCustomer);
router.get('/hot-leads', userController.getHotLeads);
router.patch('/hot-leads/:sessionId/contacted', userController.markHotLeadContacted);
router.get('/daily-summaries', userController.getDailySummaries);
router.get('/top-chats', userController.getTopChats);
router.get('/credit-summary', userController.getCreditSummary);
router.get('/credit-transactions', userController.getCreditTransactions);
router.get('/email-history', userController.getEmailHistory);
router.get('/whatsapp-proposal-history', userController.getWhatsAppProposalHistory);
router.get('/follow-up-leads', userController.getFollowUpLeads);
router.patch('/follow-up-leads/:sessionId/contacted', userController.markFollowUpContacted);
router.get('/debug-messages', userController.debugMessages); // Temporary debug endpoint
router.get('/messages/unique-emails-and-phones', userController.getUniqueEmailsAndPhones);
router.get('/leads', userController.getLeads);
router.get('/collected-leads', userController.getCollectedLeads);
router.get('/top-users', userController.getTopUsers);
router.get('/download-data', userController.downloadUserData);
router.get('/download-report', userController.downloadUserReport);
router.post('/push-token', userController.registerPushToken);

module.exports = router;

