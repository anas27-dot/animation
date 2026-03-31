/**
 * Zoho CRM Routes
 * 
 * Handle lead capture and CRM integration
 * Endpoints:
 *   GET  /api/zoho/:chatbotId
 *   POST /api/zoho/capture-lead
 */

const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const LeadCapture = require('../models/LeadCapture');
const UserSession = require('../models/UserSession');
const logger = require('../config/logging');

/**
 * GET /:chatbotId
 * Get Zoho/Lead capture configuration
 */
router.get('/:chatbotId', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    res.json({
      data: {
        enabled: chatbot.settings?.leadCaptureEnabled || chatbot.settings?.enableLeadCapture || false,
        capture_intent_keywords: chatbot.settings?.leadCaptureKeywords || [
          'contact', 'reach out', 'get in touch', 'call me', 'email me',
          'interested', 'demo', 'trial', 'pricing', 'quote'
        ],
        required_fields: chatbot.settings?.leadRequiredFields || ['name', 'phone'],
        optional_fields: chatbot.settings?.leadOptionalFields || ['email', 'company'],
        name_prompt_text: chatbot.settings?.leadNamePrompt ||
          "Great! What's your name?",
        phone_prompt_text: chatbot.settings?.leadPhonePrompt ||
          "What's your phone number?",
        email_prompt_text: chatbot.settings?.leadEmailPrompt ||
          "What's your email address?",
        company_prompt_text: chatbot.settings?.leadCompanyPrompt ||
          "Which company are you from? (optional, press enter to skip)",
        success_message: chatbot.settings?.leadSuccessMessage ||
          "✅ Thank you! We've saved your details. Our team will reach out soon!",
        // CRM settings
        crm_enabled: chatbot.settings?.crmEnabled || false,
        crm_provider: chatbot.settings?.crmProvider || 'zoho', // zoho, hubspot, salesforce
      }
    });
  } catch (error) {
    logger.error('Zoho config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /capture-lead
 * Capture lead and optionally sync to CRM
 */
router.post('/capture-lead', async (req, res) => {
  const { chatbotId, leadData, sessionId } = req.body;

  if (!chatbotId || !leadData) {
    return res.status(400).json({
      error: 'chatbotId and leadData are required'
    });
  }

  const { name, phone, email, company, message } = leadData;

  // Validate required fields
  if (!name && !phone && !email) {
    return res.status(400).json({
      error: 'At least one contact field (name, phone, or email) is required'
    });
  }

  try {
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Create lead record
    const lead = await LeadCapture.create({
      chatbotId,
      sessionId: sessionId || null,
      name: name || null,
      phone: phone?.replace(/\D/g, '') || null,
      email: email?.toLowerCase().trim() || null,
      company: company || null,
      message: message || null,
      source: 'chat_widget',
      status: 'new',
      metadata: {
        capturedAt: new Date(),
        chatbotName: chatbot.name,
        platform: 'web',
      },
    });

    // Update session with lead info
    if (sessionId) {
      await UserSession.findOneAndUpdate(
        { sessionId },
        {
          leadCaptured: true,
          leadId: lead._id,
          name: name || undefined,
          phone: phone || undefined,
          email: email || undefined,
        }
      );
    }

    // Sync to CRM if enabled
    let crmResult = null;
    if (chatbot.settings?.crmEnabled) {
      try {
        crmResult = await syncToCRM(chatbot, lead);
      } catch (crmError) {
        logger.error('CRM sync error:', crmError);
        // Don't fail the request if CRM sync fails
      }
    }

    logger.info(`Lead captured: ${lead._id} for chatbot ${chatbotId}`);

    res.json({
      success: true,
      message: 'Lead captured successfully',
      leadId: lead._id,
      crmSynced: !!crmResult,
    });

  } catch (error) {
    logger.error('Capture lead error:', error);
    
    // Check for duplicate
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'Lead with this contact already exists'
      });
    }
    
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

/**
 * GET /leads/:chatbotId
 * List captured leads (for admin)
 */
router.get('/leads/:chatbotId', async (req, res) => {
  const { chatbotId } = req.params;
  const { page = 1, limit = 20, status } = req.query;

  try {
    const query = { chatbotId };
    if (status) query.status = status;

    const leads = await LeadCapture.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await LeadCapture.countDocuments(query);

    res.json({
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      }
    });

  } catch (error) {
    logger.error('List leads error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sync lead to CRM
 * @param {Object} chatbot - Chatbot document
 * @param {Object} lead - Lead document
 */
async function syncToCRM(chatbot, lead) {
  const provider = chatbot.settings?.crmProvider || 'zoho';

  switch (provider) {
    case 'zoho':
      return syncToZoho(chatbot, lead);
    case 'hubspot':
      return syncToHubspot(chatbot, lead);
    case 'salesforce':
      return syncToSalesforce(chatbot, lead);
    default:
      logger.warn(`Unknown CRM provider: ${provider}`);
      return null;
  }
}

/**
 * Sync to Zoho CRM
 */
async function syncToZoho(chatbot, lead) {
  // TODO: Implement Zoho CRM API integration
  // const zohoConfig = chatbot.settings?.zohoConfig;
  // const response = await axios.post(
  //   'https://www.zohoapis.com/crm/v2/Leads',
  //   { data: [{ Last_Name: lead.name, Phone: lead.phone, Email: lead.email }] },
  //   { headers: { Authorization: `Zoho-oauthtoken ${zohoConfig.accessToken}` } }
  // );
  
  logger.info(`Would sync lead ${lead._id} to Zoho CRM`);
  return { synced: true, provider: 'zoho' };
}

/**
 * Sync to HubSpot
 */
async function syncToHubspot(chatbot, lead) {
  // TODO: Implement HubSpot API integration
  logger.info(`Would sync lead ${lead._id} to HubSpot`);
  return { synced: true, provider: 'hubspot' };
}

/**
 * Sync to Salesforce
 */
async function syncToSalesforce(chatbot, lead) {
  // TODO: Implement Salesforce API integration
  logger.info(`Would sync lead ${lead._id} to Salesforce`);
  return { synced: true, provider: 'salesforce' };
}

module.exports = router;
