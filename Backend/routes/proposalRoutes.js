/**
 * Proposal Routes
 * 
 * Handle sidebar proposal functionality
 * Endpoints:
 *   GET  /api/proposal/:chatbotId
 *   GET  /api/proposal/:chatbotId/templates
 *   POST /api/proposal/send
 *   POST /api/proposal/:chatbotId/templates (admin)
 *   PUT  /api/proposal/:chatbotId/templates/:templateId (admin)
 *   DELETE /api/proposal/:chatbotId/templates/:templateId (admin)
 */

const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const WhatsAppProposalTemplate = require('../models/WhatsAppProposalTemplate');
const { sendProposal } = require('../services/proposalService');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const { authenticateAPIKey } = require('../middleware/authMiddleware');
const logger = require('../config/logging');

// Debug: Log all requests to proposal routes
router.use((req, res, next) => {
  logger.info(`[Proposal Routes] ${req.method} ${req.path} - Original URL: ${req.originalUrl}, Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  next();
});

/**
 * Middleware that accepts JWT (admin) or API key
 */
const authenticateFlexible = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await authenticateJWT(req, res, () => {
        if (req.user && req.user.type === 'admin') {
          return next();
        }
        // Try API key if JWT fails or not admin
        authenticateAPIKey(req, res, next);
      });
    } catch (err) {
      authenticateAPIKey(req, res, next);
    }
  } else {
    authenticateAPIKey(req, res, next);
  }
};

/**
 * POST /send
 * Send proposal from sidebar (public - requires verified user)
 * NOTE: This must come before /:chatbotId to avoid route conflicts
 */
router.post('/send', async (req, res) => {
  const { chatbotId, phone, templateId, templateName, serviceName } = req.body;

  if (!chatbotId || !phone) {
    return res.status(400).json({
      error: 'chatbotId and phone are required',
    });
  }

  try {
    const result = await sendProposal(phone, chatbotId, {
      serviceName,
      templateId,
      templateName,
    });

    if (!result.ok) {
      return res.status(400).json({
        error: result.error || 'Failed to send proposal',
      });
    }

    res.json({
      success: true,
      message: 'Proposal sent successfully',
      data: result.data,
    });
  } catch (error) {
    logger.error('Send proposal error:', error);
    res.status(500).json({ error: 'Failed to send proposal' });
  }
});

/**
 * GET /test
 * Test endpoint to verify route registration
 */
router.get('/test', (req, res) => {
  logger.info('[Proposal] Test endpoint hit!');
  res.json({ success: true, message: 'Proposal routes are working!' });
});

/**
 * GET /health
 * Health check for proposal routes
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', route: 'proposal', timestamp: new Date().toISOString() });
});

// IMPORTANT: Static routes must come before parameterized routes
// This route handles GET /api/proposal/:chatbotId
/**
 * GET /:chatbotId
 * Get sidebar proposal configuration and templates (public)
 */
router.get('/:chatbotId', async (req, res) => {
  try {
    const chatbotId = req.params.chatbotId;
    logger.info(`[Proposal] GET /:chatbotId - Requested chatbotId: ${chatbotId}, Full path: ${req.path}, Original URL: ${req.originalUrl}, Method: ${req.method}`);
    
    if (!chatbotId) {
      logger.warn(`[Proposal] Missing chatbotId`);
      return res.status(400).json({ error: 'Chatbot ID is required' });
    }
    
    const chatbot = await Chatbot.findById(chatbotId).lean();
    
    if (!chatbot) {
      logger.warn(`[Proposal] Chatbot not found: ${req.params.chatbotId}`);
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Get templates from database
    const dbTemplates = await WhatsAppProposalTemplate.find({
      chatbot_id: req.params.chatbotId,
      is_active: true,
    })
      .sort({ order: 1, createdAt: -1 })
      .select('-api_key') // Don't expose API keys
      .lean();

    // Merge with chatbot.settings templates
    const settingsTemplates = chatbot.settings?.proposalTemplates || [];
    const allTemplates = [...dbTemplates, ...settingsTemplates.filter(t => t.is_active !== false)];

    logger.info(`[Proposal] Returning config for chatbot ${req.params.chatbotId}: ${allTemplates.length} templates`);

    res.json({
      data: {
        enabled: chatbot.settings?.sidebar?.whatsapp_proposal?.enabled || false,
        display_text: chatbot.settings?.sidebar?.whatsapp_proposal?.display_text || 'Get Quote',
        templates: allTemplates.map(t => ({
          id: t._id?.toString() || t._id,
          display_name: t.display_name,
          description: t.description,
          campaign_name: t.campaign_name,
          template_name: t.template_name,
          media: t.media || {},
          order: t.order || 0,
        })),
      },
    });
  } catch (error) {
    logger.error('Get proposal config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:chatbotId/templates
 * Get available proposal templates (public)
 */
router.get('/:chatbotId/templates', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId).lean();
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Get templates from database
    const dbTemplates = await WhatsAppProposalTemplate.find({
      chatbot_id: req.params.chatbotId,
      is_active: true,
    })
      .sort({ order: 1, createdAt: -1 })
      .select('-api_key')
      .lean();

    // Merge with chatbot.settings templates
    const settingsTemplates = chatbot.settings?.proposalTemplates || [];
    const allTemplates = [...dbTemplates, ...settingsTemplates.filter(t => t.is_active !== false)];

    res.json({
      data: allTemplates.map(t => ({
        id: t._id?.toString() || t._id,
        display_name: t.display_name,
        description: t.description,
        campaign_name: t.campaign_name,
        template_name: t.template_name,
        media: t.media || {},
        order: t.order || 0,
      })),
    });
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: error.message });
  }
});


/**
 * POST /:chatbotId/templates
 * Create new template (admin only)
 */
router.post('/:chatbotId/templates', authenticateFlexible, async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const {
      display_name,
      description,
      campaign_name,
      template_name,
      api_key,
      org_slug,
      sender_name,
      country_code,
      media,
      template_params,
      order,
      is_active,
    } = req.body;

    if (!display_name || !campaign_name || !template_name) {
      return res.status(400).json({
        error: 'display_name, campaign_name, and template_name are required',
      });
    }

    const template = new WhatsAppProposalTemplate({
      chatbot_id: req.params.chatbotId,
      display_name,
      description: description || null,
      campaign_name,
      template_name,
      api_key: api_key || null,
      org_slug: org_slug || null,
      sender_name: sender_name || null,
      country_code: country_code || '91',
      media: media || {},
      template_params: template_params || [],
      order: order || 0,
      is_active: is_active !== false,
    });

    await template.save();

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /:chatbotId/templates/:templateId
 * Update template (admin only)
 */
router.put('/:chatbotId/templates/:templateId', authenticateFlexible, async (req, res) => {
  try {
    const template = await WhatsAppProposalTemplate.findOne({
      _id: req.params.templateId,
      chatbot_id: req.params.chatbotId,
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const {
      display_name,
      description,
      campaign_name,
      template_name,
      api_key,
      org_slug,
      sender_name,
      country_code,
      media,
      template_params,
      order,
      is_active,
    } = req.body;

    if (display_name) template.display_name = display_name;
    if (description !== undefined) template.description = description;
    if (campaign_name) template.campaign_name = campaign_name;
    if (template_name) template.template_name = template_name;
    if (api_key !== undefined) template.api_key = api_key;
    if (org_slug !== undefined) template.org_slug = org_slug;
    if (sender_name !== undefined) template.sender_name = sender_name;
    if (country_code !== undefined) template.country_code = country_code;
    if (media !== undefined) template.media = media;
    if (template_params !== undefined) template.template_params = template_params;
    if (order !== undefined) template.order = order;
    if (is_active !== undefined) template.is_active = is_active;

    await template.save();

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Update template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /:chatbotId/templates/:templateId
 * Delete template (admin only)
 */
router.delete('/:chatbotId/templates/:templateId', authenticateFlexible, async (req, res) => {
  try {
    const template = await WhatsAppProposalTemplate.findOneAndDelete({
      _id: req.params.templateId,
      chatbot_id: req.params.chatbotId,
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug: Catch-all to verify router is being hit
router.use((req, res, next) => {
  logger.warn(`[Proposal Routes] Unmatched route: ${req.method} ${req.path} - Original URL: ${req.originalUrl}`);
  // Don't call next() here - let it fall through to 404
  next();
});

module.exports = router;
