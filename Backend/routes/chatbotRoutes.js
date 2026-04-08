const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');

const chatBgRoot = path.join(__dirname, '..', 'uploads', 'chat-backgrounds');
const productImgRoot = path.join(__dirname, '..', 'uploads', 'product-images');
const chatBackgroundMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(chatBgRoot, String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      const safeExt = ext.match(/^\.[a-z0-9]+$/i) ? ext.toLowerCase() : '.jpg';
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${safeExt}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

function chatBackgroundUploadMiddleware(req, res, next) {
  chatBackgroundMulter.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 8MB or smaller' });
      }
      return res.status(400).json({ error: err.message || 'Invalid file' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    next();
  });
}

const productImageMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(productImgRoot, String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '';
      const safeExt = ext.match(/^\.[a-z0-9]+$/i) ? ext.toLowerCase() : '.jpg';
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${safeExt}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

function productImageUploadMiddleware(req, res, next) {
  productImageMulter.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 8MB or smaller' });
      }
      return res.status(400).json({ error: err.message || 'Invalid file' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    next();
  });
}
const emailTemplateController = require('../controllers/emailTemplateController');
const { authenticateAPIKey } = require('../middleware/authMiddleware');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { sensitiveLimiter } = require('../middleware/rateLimiter');
const { notifyWebsiteVisitor } = require('../services/pushNotificationService');
const Chatbot = require('../models/Chatbot');

// Middleware that accepts either JWT or API key (optional for list endpoint)
const optionalAuth = async (req, res, next) => {
  // Try JWT first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.substring(7);
      const JWT_SECRET = process.env.JWT_SECRET;
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      // JWT failed, continue without auth (for public access)
    }
  }

  // Try API key (optional)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const Company = require('../models/Company');
      const company = await Company.findOne({ apiKey, isActive: true });
      if (company) {
        req.company = company;
      }
    } catch (err) {
      // API key failed, continue without auth
    }
  }

  next();
};

// List all chatbots - optional auth (shows all for admins, filtered for companies)
// Must be before /:id route to avoid matching
router.get('/', optionalAuth, chatbotController.getAllChatbots);
router.get('/all', optionalAuth, chatbotController.getAllChatbots); // Alias for frontend

// Public endpoint - Get chatbot by ID (no auth required for widget)
router.get('/:id', chatbotController.getChatbot);

// Get chatbot config (for UI customization)
router.get('/:id/config', chatbotController.getChatbotConfig);
// Public config endpoint for embed scripts (no auth required)
router.get('/:id/config/public', chatbotController.getChatbotConfig);

// Public chat endpoint for embed scripts (no auth required)
router.post('/:id/chat/public', chatbotController.chatPublic);

// Public Email Template routes (no auth required - same as proposal templates)
router.get('/:id/email-templates', emailTemplateController.getEmailTemplates);
router.post('/:id/send-email', emailTemplateController.sendEmail);

// Public Custom Navigation Items route (no auth required - used by UI)
router.get('/:id/custom-navigation-items', chatbotController.getCustomNavigationItems);

// Public Embed Script route (no auth required - used by Admin Dashboard)
router.get('/:id/embed-script', chatbotController.getEmbedScript);

// Public endpoint - Notify when visitor arrives (called by chatbot widget)
router.post('/:id/visitor-arrived', async (req, res) => {
  try {
    const { id } = req.params;
    const { page, referrer, userAgent } = req.body;

    const chatbot = await Chatbot.findById(id).populate('company');

    if (!chatbot || !chatbot.company) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Send push notification to all users in the company
    await notifyWebsiteVisitor(chatbot.company._id, {
      page: page || 'Unknown',
      referrer: referrer || '',
      userAgent: userAgent || '',
      chatbotId: id,
      chatbotName: chatbot.name,
    });

    return res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Error in visitor-arrived endpoint:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Persona endpoints (before protected section - uses optionalAuth for GET, flexible auth for PUT)
router.get('/:id/persona', optionalAuth, chatbotController.getChatbotPersona);

// Protected endpoints - require API key OR JWT (for admin dashboard)
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

      if (req.user.type === 'admin') {
        // Admin authenticated via JWT - get company from request body
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

// Chatbot endpoints
router.post('/', chatbotController.createChatbot);
router.post('/create', chatbotController.createChatbot); // Alias for frontend
router.get('/download/:id', chatbotController.downloadChatbot); // Download before /:id to avoid conflict

// Sidebar Configuration endpoints
router.get('/:id/sidebar-config', authenticateJWT, chatbotController.getChatbotSidebarConfig);
router.put('/:id/sidebar-config/header', authenticateJWT, chatbotController.updateSidebarHeader);

// UI Configuration endpoints
router.put('/:id/ui-config/text', authenticateJWT, chatbotController.updateTextConfig);
router.put('/:id/ui-config/assistant', authenticateJWT, chatbotController.updateAssistantConfig);
router.put('/:id/ui-config/avatar', authenticateJWT, chatbotController.updateAvatarConfig);
router.put('/:id/ui-config/sidebar', authenticateJWT, chatbotController.updateSidebarConfig);
router.put('/:id/ui-config/tab', authenticateJWT, chatbotController.updateTabConfig);
router.put('/:id/ui-config/placeholders', authenticateJWT, chatbotController.updatePlaceholdersConfig);
router.put('/:id/ui-config/contact', authenticateJWT, chatbotController.updateContactConfig);
router.put('/:id/ui-config/background', authenticateJWT, chatbotController.updateChatBackgroundConfig);
router.post(
  '/:id/chat-background/upload',
  authenticateJWT,
  chatBackgroundUploadMiddleware,
  chatbotController.uploadChatBackgroundFile
);
router.post('/:id/chat-background/upload-url', authenticateJWT, chatbotController.getChatBackgroundUploadUrl);

// Sidebar Configuration endpoints
router.put('/:id/sidebar-config/branding', authenticateJWT, chatbotController.updateSidebarBranding);
router.put('/:id/sidebar-config/whatsapp', authenticateJWT, chatbotController.updateSidebarWhatsApp);
router.put('/:id/sidebar-config/call', authenticateJWT, chatbotController.updateSidebarCall);
router.put('/:id/sidebar-config/calendly', authenticateJWT, chatbotController.updateSidebarCalendly);
router.put('/:id/sidebar-config/email', authenticateJWT, chatbotController.updateSidebarEmail);
router.put('/:id/sidebar-config/whatsapp-proposal', authenticateJWT, chatbotController.updateSidebarWhatsAppProposal);
router.put('/:id/sidebar-config/social', authenticateJWT, chatbotController.updateSidebarSocial);
router.put('/:id/sidebar-config/custom-nav', authenticateJWT, chatbotController.updateSidebarCustomNav);
router.put('/:id/sidebar-config/user-dashboard', authenticateJWT, chatbotController.updateSidebarUserDashboard);
router.put('/:id/sidebar-config/enabled', authenticateJWT, chatbotController.updateSidebarEnabled);
router.put('/:id/sidebar-config/demo-mode', authenticateJWT, chatbotController.updateChatbotDemoMode);
router.put('/:id/ui-config/skater-girl', authenticateJWT, chatbotController.updateSkaterGirlConfig);

router.put('/:id', chatbotController.updateChatbot);
router.put('/edit/:id', chatbotController.updateChatbot); // Alias for frontend
router.put('/:id/config', authenticateJWT, chatbotController.updateChatbotConfig);
router.put('/:id/persona', chatbotController.updateChatbotPersona); // Update persona
router.delete('/:id', chatbotController.deleteChatbot);
router.delete('/delete/:id', chatbotController.deleteChatbot); // Alias for frontend
router.post('/:id/knowledge', chatbotController.uploadKnowledge);
router.delete('/:id/knowledge/:docId', chatbotController.deleteKnowledge);

// Email Template admin routes (require JWT - create, update, delete)
router.post('/:id/email-templates', authenticateJWT, sensitiveLimiter, emailTemplateController.createEmailTemplate);
router.put('/:id/email-templates/:templateId', authenticateJWT, sensitiveLimiter, emailTemplateController.updateEmailTemplate);
router.delete('/:id/email-templates/:templateId', authenticateJWT, sensitiveLimiter, emailTemplateController.deleteEmailTemplate);

// Custom Navigation Items routes (POST, PUT, DELETE require JWT)
router.post('/:id/custom-navigation-items', authenticateJWT, chatbotController.createCustomNavigationItem);
router.put('/:id/custom-navigation-items/:itemId', authenticateJWT, chatbotController.updateCustomNavigationItem);
router.delete('/:id/custom-navigation-items/:itemId', authenticateJWT, chatbotController.deleteCustomNavigationItem);

// Product Images routes (POST, PUT require JWT)
router.post(
  '/:id/product-images/upload',
  authenticateJWT,
  productImageUploadMiddleware,
  chatbotController.uploadProductImageFile
);
router.post('/:id/product-images/upload-url', authenticateJWT, chatbotController.getProductImagesUploadUrl);
router.put('/:id/product-images', authenticateJWT, chatbotController.updateProductImagesConfig);

module.exports = router;

