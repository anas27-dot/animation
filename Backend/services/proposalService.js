/**
 * Proposal Service
 * 
 * Handles sending proposals via WhatsApp to verified users
 */

const Chatbot = require('../models/Chatbot');
const WhatsAppProposalTemplate = require('../models/WhatsAppProposalTemplate');
const sendWhatsAppProposal = require('../utils/sendWhatsAppProposal');
const resolveAISensyConfig = require('../utils/resolveAISensyConfig');
const logger = require('../config/logging');

/**
 * Send proposal to verified user's WhatsApp number
 * @param {string} phone - Verified phone number
 * @param {string} chatbotId - Chatbot ID
 * @param {object} options - Additional options
 * @param {string} options.serviceName - Service name
 * @param {string} options.templateId - Template ID (optional)
 * @param {string} options.templateName - Template name (optional)
 * @param {string} options.campaignName - Campaign name override (optional)
 * @param {object} options.media - Media override (optional)
 * @returns {Promise<{ok: boolean, error?: string, data?: any}>}
 */
async function sendProposal(phone, chatbotId, options = {}) {
  const {
    serviceName = 'AI Chat Agent',
    templateId,
    templateName,
    campaignNameOverride,
    media: mediaOverride,
  } = options;

  try {
    // Get chatbot
    const chatbot = await Chatbot.findById(chatbotId).lean();
    if (!chatbot) {
      return { ok: false, error: 'Chatbot not found' };
    }

    // Try to get template from database first
    let template = null;
    if (templateId) {
      template = await WhatsAppProposalTemplate.findOne({
        _id: templateId,
        chatbot_id: chatbotId,
        is_active: true,
      }).lean();
    } else if (templateName) {
      template = await WhatsAppProposalTemplate.findOne({
        chatbot_id: chatbotId,
        is_active: true,
        $or: [
          { template_name: templateName },
          { display_name: templateName },
        ],
      }).lean();
    }

    // If no template found in DB, check chatbot.settings.proposalTemplates
    if (!template && chatbot.settings?.proposalTemplates?.length > 0) {
      if (templateId) {
        template = chatbot.settings.proposalTemplates.find(
          t => t._id?.toString() === templateId.toString()
        );
      } else if (templateName) {
        template = chatbot.settings.proposalTemplates.find(
          t => t.template_name === templateName || t.display_name === templateName
        );
      } else {
        // Use first active template
        template = chatbot.settings.proposalTemplates.find(t => t.is_active !== false) 
          || chatbot.settings.proposalTemplates[0];
      }
    }

    // Resolve AISensy config with fallback hierarchy
    const { apiKey, orgSlug, senderName, countryCode } = resolveAISensyConfig(template, chatbot);

    if (!apiKey) {
      return { ok: false, error: 'AISensy API key not configured' };
    }

    // Determine campaign name
    const campaignName = campaignNameOverride 
      || template?.campaign_name 
      || chatbot.settings?.proposal_campaign_name
      || 'proposalsending';

    // Determine template name
    const finalTemplateName = template?.template_name || chatbot.settings?.proposal_template_name || null;

    // Determine media
    const media = mediaOverride || template?.media || chatbot.settings?.intentMedia || {};

    // Get template parameters and convert to AISensy format
    // AISensy expects an array of values, not objects
    let templateParams = [];
    if (template?.template_params && Array.isArray(template.template_params)) {
      templateParams = template.template_params.map(param => {
        // If it's already a string/number, use it directly
        if (typeof param === 'string' || typeof param === 'number') {
          return param;
        }
        // If it's an object with param_value, extract the value
        if (param && typeof param === 'object' && param.param_value !== undefined) {
          return param.param_value;
        }
        // If it's an object with just a value property, use that
        if (param && typeof param === 'object' && param.value !== undefined) {
          return param.value;
        }
        // Fallback: convert to string
        return String(param);
      });
      
      logger.info(`📋 Template params converted:`, {
        original: template.template_params,
        converted: templateParams,
        campaignName,
        templateName: finalTemplateName,
      });
    } else {
      logger.warn(`⚠️ No template params found for template:`, {
        templateId: template?._id,
        templateName: finalTemplateName,
        campaignName,
      });
    }

    // Send proposal via WhatsApp
    const result = await sendWhatsAppProposal({
      phone,
      serviceName,
      campaignName,
      templateName: finalTemplateName,
      templateParams,
      media,
      apiKey,
      orgSlug,
      senderName,
      countryCode,
    });

    if (result.ok) {
      logger.info(`✅ Proposal sent to ${phone} for chatbot ${chatbotId}`);
      return {
        ok: true,
        data: {
          phone,
          serviceName,
          campaignName,
          templateName: finalTemplateName,
          sentAt: new Date(),
          messageId: result.data?.id || result.data?.messageId,
        },
      };
    } else {
      logger.error(`❌ Failed to send proposal to ${phone}: ${result.error}`);
      return { ok: false, error: result.error || 'Failed to send proposal' };
    }
  } catch (error) {
    logger.error(`❌ Proposal sending error: ${error.message}`);
    return { ok: false, error: error.message || 'Failed to send proposal' };
  }
}

module.exports = {
  sendProposal,
};
