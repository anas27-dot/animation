/**
 * Intent Routes
 * 
 * Handle special intents like sending proposals via WhatsApp
 * Endpoints:
 *   GET  /api/intent/:chatbotId
 *   POST /api/intent/send-proposal
 */

const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const UserSession = require('../models/UserSession');
const { sendProposal } = require('../services/proposalService');
const { getIntentConfig } = require('../services/intentDetectionService');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const logger = require('../config/logging');

/**
 * GET /:chatbotId
 * Get intent configuration for a chatbot (public)
 */
router.get('/:chatbotId', async (req, res) => {
  try {
    const config = await getIntentConfig(req.params.chatbotId);

    if (!config) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Don't expose sensitive config to public
    res.json({
      data: {
        enabled: config.enabled,
        keywords: config.keywords, // Keep for backward compatibility
        proposal_condition: config.proposal_condition,
        proposal_campaign_name: config.proposal_campaign_name,
        proposal_template_name: config.proposal_template_name,
        confirmation_prompt_text: config.confirmation_prompt_text,
        template_choice_prompt_text: config.template_choice_prompt_text,
        template_choice_allowlist: config.template_choice_allowlist,
        success_message: config.success_message,
        toast_message: config.toast_message,
        prompt_for_template_choice: config.prompt_for_template_choice,
        media: config.media,
      },
    });
  } catch (error) {
    logger.error('Intent config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /:chatbotId
 * Update intent configuration (admin only)
 */
router.put('/:chatbotId', authenticateJWT, async (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const chatbot = await Chatbot.findById(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const {
      enabled,
      keywords,
      proposal_condition,
      proposal_campaign_name,
      proposal_template_name,
      intentMedia,
      intentPromptForChoice,
      intentTemplateAllowlist,
      intentConfirmationText,
      intentTemplateChoiceText,
      intentSuccessMessage,
      intentToastMessage,
      intentPositiveResponses,
      intentNegativeResponses,
      intentTimeoutMinutes,
    } = req.body;

    // Validate keywords array (for backward compatibility)
    if (keywords && !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords must be an array' });
    }

    // Validate proposal_condition (should be a string)
    if (proposal_condition !== undefined && typeof proposal_condition !== 'string') {
      return res.status(400).json({ error: 'Proposal condition must be a string' });
    }

    // Update settings
    if (enabled !== undefined) chatbot.settings.intentEnabled = enabled;
    if (keywords !== undefined) chatbot.settings.intentKeywords = keywords; // Keep for backward compatibility
    if (proposal_condition !== undefined) chatbot.settings.proposal_condition = proposal_condition;
    if (proposal_campaign_name !== undefined) chatbot.settings.proposal_campaign_name = proposal_campaign_name;
    if (proposal_template_name !== undefined) chatbot.settings.proposal_template_name = proposal_template_name;
    if (intentMedia !== undefined) chatbot.settings.intentMedia = intentMedia;
    if (intentPromptForChoice !== undefined) chatbot.settings.intentPromptForChoice = intentPromptForChoice;
    if (intentTemplateAllowlist !== undefined) chatbot.settings.intentTemplateAllowlist = intentTemplateAllowlist;
    if (intentConfirmationText !== undefined) chatbot.settings.intentConfirmationText = intentConfirmationText;
    if (intentTemplateChoiceText !== undefined) chatbot.settings.intentTemplateChoiceText = intentTemplateChoiceText;
    if (intentSuccessMessage !== undefined) chatbot.settings.intentSuccessMessage = intentSuccessMessage;
    if (intentToastMessage !== undefined) chatbot.settings.intentToastMessage = intentToastMessage;
    if (intentPositiveResponses !== undefined) chatbot.settings.intentPositiveResponses = intentPositiveResponses;
    if (intentNegativeResponses !== undefined) chatbot.settings.intentNegativeResponses = intentNegativeResponses;
    if (intentTimeoutMinutes !== undefined) chatbot.settings.intentTimeoutMinutes = intentTimeoutMinutes;

    chatbot.markModified('settings');
    await chatbot.save();

    logger.info(`✅ Intent config updated for chatbot ${req.params.chatbotId}`);

    res.json({
      success: true,
      message: 'Intent configuration updated successfully',
      data: await getIntentConfig(req.params.chatbotId),
    });
  } catch (error) {
    logger.error('Update intent config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /send-proposal
 * Send proposal to user's WhatsApp (from intent flow)
 */
router.post('/send-proposal', async (req, res) => {
  const { chatbotId, phone, serviceName, template_name, templateId } = req.body;

  if (!chatbotId || !phone) {
    return res.status(400).json({
      error: 'chatbotId and phone are required',
    });
  }

  try {
    const result = await sendProposal(phone, chatbotId, {
      serviceName,
      templateName: template_name,
      templateId,
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
 * GET /:chatbotId/templates
 * Get available proposal templates
 */
router.get('/:chatbotId/templates', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const templates = chatbot.settings?.proposalTemplates || [
      { name: 'general', display_name: 'General Proposal', description: 'Standard proposal' },
    ];

    res.json({ data: templates });
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:chatbotId/email-intent
 * Get email intent configuration for a chatbot (public)
 */
router.get('/:chatbotId/email-intent', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const emailIntentConfig = chatbot.settings?.email_intent || {};

    res.json({
      data: {
        enabled: emailIntentConfig.enabled || false,
        condition: emailIntentConfig.condition || 'User wants to receive information via email',
        confirmation_prompt_text: emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?',
        template_choice_prompt_text: emailIntentConfig.template_choice_prompt_text || 'Which email template would you like?',
        template_choice_allowlist: emailIntentConfig.template_choice_allowlist || [],
        success_message: emailIntentConfig.success_message || '✅ Email sent successfully!',
        toast_message: emailIntentConfig.toast_message || 'Email sent!',
        prompt_for_template_choice: emailIntentConfig.prompt_for_template_choice !== undefined ? emailIntentConfig.prompt_for_template_choice : true,
        positive_responses: emailIntentConfig.positive_responses || ['yes', 'sure', 'ok', 'send', 'please'],
        negative_responses: emailIntentConfig.negative_responses || ['no', 'cancel', "don't", 'skip'],
      },
    });
  } catch (error) {
    logger.error('Email intent config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /:chatbotId/email-intent
 * Update email intent configuration (admin only)
 */
router.put('/:chatbotId/email-intent', authenticateJWT, async (req, res) => {
  try {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const chatbot = await Chatbot.findById(req.params.chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    const {
      enabled,
      condition,
      confirmation_prompt_text,
      template_choice_prompt_text,
      template_choice_allowlist,
      success_message,
      toast_message,
      prompt_for_template_choice,
      positive_responses,
      negative_responses,
    } = req.body;

    // Initialize email_intent if it doesn't exist
    if (!chatbot.settings.email_intent) {
      chatbot.settings.email_intent = {};
    }

    // Validate condition (should be a string)
    if (condition !== undefined && typeof condition !== 'string') {
      return res.status(400).json({ error: 'Email condition must be a string' });
    }

    // Update email intent settings
    if (enabled !== undefined) chatbot.settings.email_intent.enabled = enabled;
    if (condition !== undefined) chatbot.settings.email_intent.condition = condition;
    if (confirmation_prompt_text !== undefined) chatbot.settings.email_intent.confirmation_prompt_text = confirmation_prompt_text;
    if (template_choice_prompt_text !== undefined) chatbot.settings.email_intent.template_choice_prompt_text = template_choice_prompt_text;
    if (template_choice_allowlist !== undefined) chatbot.settings.email_intent.template_choice_allowlist = template_choice_allowlist;
    if (success_message !== undefined) chatbot.settings.email_intent.success_message = success_message;
    if (toast_message !== undefined) chatbot.settings.email_intent.toast_message = toast_message;
    if (prompt_for_template_choice !== undefined) chatbot.settings.email_intent.prompt_for_template_choice = prompt_for_template_choice;
    if (positive_responses !== undefined) chatbot.settings.email_intent.positive_responses = Array.isArray(positive_responses) ? positive_responses : [];
    if (negative_responses !== undefined) chatbot.settings.email_intent.negative_responses = Array.isArray(negative_responses) ? negative_responses : [];

    // Mark settings as modified for Mongoose to detect nested changes
    chatbot.markModified('settings');
    chatbot.markModified('settings.email_intent');

    await chatbot.save();

    logger.info(`✅ Email intent config updated for chatbot ${req.params.chatbotId}`);

    // Return updated config
    const emailIntentConfig = chatbot.settings.email_intent || {};
    res.json({
      success: true,
      message: 'Email intent configuration updated successfully',
      data: {
        enabled: emailIntentConfig.enabled || false,
        condition: emailIntentConfig.condition || 'User wants to receive information via email',
        confirmation_prompt_text: emailIntentConfig.confirmation_prompt_text || 'Would you like to receive this via email?',
        template_choice_prompt_text: emailIntentConfig.template_choice_prompt_text || 'Which email template would you like?',
        template_choice_allowlist: emailIntentConfig.template_choice_allowlist || [],
        success_message: emailIntentConfig.success_message || '✅ Email sent successfully!',
        toast_message: emailIntentConfig.toast_message || 'Email sent!',
        prompt_for_template_choice: emailIntentConfig.prompt_for_template_choice !== undefined ? emailIntentConfig.prompt_for_template_choice : true,
        positive_responses: emailIntentConfig.positive_responses || ['yes', 'sure', 'ok', 'send', 'please'],
        negative_responses: emailIntentConfig.negative_responses || ['no', 'cancel', "don't", 'skip'],
      },
    });
  } catch (error) {
    logger.error('Update email intent config error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
