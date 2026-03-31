const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');

// Public route - Admin login (no rate limit)
router.post('/login', adminController.login);

// Protected routes - require JWT authentication
router.use(authenticateJWT);

// Check if user is admin
router.use((req, res, next) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

// Admin routes
router.get('/stats', adminController.getStats);
router.get('/trends', adminController.getTrends);
router.get('/all', adminController.getAllAdmins);
router.post('/create', adminController.createAdmin);
router.put('/:id', adminController.updateAdmin);
router.put('/toggle-role/:id', adminController.toggleAdminRole);
router.delete('/:id', adminController.deleteAdmin);
router.delete('/delete/:id', adminController.deleteAdmin); // Alias for frontend

// User Management routes (temporary for company deletion)
router.get('/users', adminController.getAllUsers);
router.delete('/users/:id', adminController.deleteUser);

// Daily Email routes
router.get('/daily-email-template', adminController.getDailyEmailTemplate);
router.put('/daily-email-template', adminController.updateDailyEmailTemplate);
router.post('/send-daily-email', adminController.sendDailyEmail);
router.get('/daily-email-logs', adminController.getDailyEmailLogs);

// Daily Summary routes (for testing/manual trigger)
router.post('/trigger-daily-summary', adminController.triggerDailySummary);

// Company Management routes
// Update company crawler settings
router.put('/companies/:companyId/crawler', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { enabled } = req.body;
    const Company = require('../models/Company');

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Update crawler settings with fixed schedule
    company.settings = company.settings || {};
    company.settings.crawler = company.settings.crawler || {};
    company.settings.crawler.enabled = enabled;
    company.settings.crawler.schedule = '0 0 * * *'; // Fixed: 12:00 AM IST

    await company.save();

    res.json({
      success: true,
      company: {
        _id: company._id,
        name: company.userName,
        settings: company.settings
      }
    });

  } catch (error) {
    console.error('Update company crawler settings error:', error);
    res.status(500).json({ error: 'Failed to update crawler settings' });
  }
});

// Update company domain
router.put('/companies/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { domain, url, name, email } = req.body;
    const Company = require('../models/Company');
    const Chatbot = require('../models/Chatbot');

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Update company fields
    const finalDomain = domain || url;
    if (finalDomain) company.domain = finalDomain;
    if (name) company.userName = name;
    if (email) company.email = email;

    await company.save();

    // ✅ Synchronize domain update with associated chatbots
    if (finalDomain) {
      try {
        const chatbots = await Chatbot.find({ company: company._id });
        if (chatbots.length > 0) {
          const updatePromises = chatbots.map(bot => {
            const allowedDomains = bot.settings?.allowedDomains || [];
            const domainValue = finalDomain.replace(/^https?:\/\//, '').split('/')[0];

            if (!allowedDomains.includes(domainValue)) {
              allowedDomains.push(domainValue);
            }

            return Chatbot.updateOne(
              { _id: bot._id },
              {
                $set: {
                  websiteUrl: finalDomain,
                  'settings.allowedDomains': allowedDomains
                }
              }
            );
          });
          await Promise.all(updatePromises);
        }
      } catch (syncError) {
        console.error('Chatbot sync error in adminRoutes:', syncError);
      }
    }

    res.json({
      success: true,
      company: {
        _id: company._id,
        name: company.userName,
        domain: company.domain,
        email: company.email
      }
    });

  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

module.exports = router;

