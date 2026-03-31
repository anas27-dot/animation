/**
 * Authentication Routes
 * 
 * OTP-based authentication for chat widget
 * Endpoints:
 *   GET  /api/chatbot/:chatbotId/auth-config
 *   POST /api/chatbot/auth/send-otp
 *   POST /api/chatbot/auth/verify-otp
 */

const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const UserSession = require('../models/UserSession');
const logger = require('../config/logging');
const { strictLimiter } = require('../middleware/rateLimiter');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;
const OTP_COOLDOWN_MS = 60 * 1000; // 1 minute between resends

/**
 * GET /:chatbotId/auth-config
 * Get authentication configuration for a chatbot
 */
router.get('/:chatbotId/auth-config', async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.chatbotId);

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Return auth configuration
    res.json({
      data: {
        auth_enabled: chatbot.settings?.authentication?.isEnabled || false,
        auth_provider: chatbot.settings?.authProvider || 'aisensy',
        auth_trigger_message_count: chatbot.settings?.authTriggerCount || 3,
        auth_phone_prompt_text: chatbot.settings?.authPhonePrompt ||
          "To continue our conversation, please share your WhatsApp number.",
        auth_otp_prompt_text: chatbot.settings?.authOtpPrompt ||
          "I've sent a 6-digit OTP to your WhatsApp. Please enter it to verify.",
        auth_success_text: chatbot.settings?.authSuccessText ||
          "Great! You're verified. Let's continue our conversation.",
        auth_failure_text: chatbot.settings?.authFailureText ||
          "Invalid OTP. Please try again.",
      }
    });
  } catch (error) {
    logger.error('Auth config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /auth/send-otp
 * Send OTP to user's WhatsApp number
 */
router.post('/auth/send-otp', strictLimiter, async (req, res) => {
  const { chatbotId, phone, name } = req.body;

  if (!chatbotId || !phone) {
    return res.status(400).json({
      error: 'chatbotId and phone are required'
    });
  }

  // Validate phone format (basic validation)
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return res.status(400).json({
      error: 'Invalid phone number format'
    });
  }

  try {
    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }

    // Check cooldown
    const otpKey = `${chatbotId}:${cleanPhone}`;
    const existingOtp = otpStore.get(otpKey);

    if (existingOtp && Date.now() - existingOtp.createdAt < OTP_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - existingOtp.createdAt)) / 1000);
      return res.status(429).json({
        error: `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
        retryAfter: remainingSeconds
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP
    otpStore.set(otpKey, {
      otp,
      phone: cleanPhone,
      name: name || null,
      chatbotId,
      createdAt: Date.now(),
      attempts: 0,
    });

    // TODO: Send OTP via WhatsApp using AiSensy/Twilio/etc
    // For now, log it (remove in production!)
    logger.info(`OTP for ${cleanPhone}: ${otp}`);

    // In production, integrate with your OTP provider:
    // await sendWhatsAppOTP(cleanPhone, otp, chatbot.settings.otpTemplate);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      phone: cleanPhone.slice(-4).padStart(cleanPhone.length, '*'), // Masked phone
    });

  } catch (error) {
    logger.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

/**
 * POST /auth/verify-otp
 * Verify OTP and authenticate user
 */
router.post('/auth/verify-otp', strictLimiter, async (req, res) => {
  const { chatbotId, phone, otp, sessionId, name } = req.body;

  if (!chatbotId || !phone || !otp) {
    return res.status(400).json({
      error: 'chatbotId, phone, and otp are required'
    });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const otpKey = `${chatbotId}:${cleanPhone}`;

  try {
    const storedData = otpStore.get(otpKey);

    // Check if OTP exists
    if (!storedData) {
      return res.status(400).json({
        error: 'OTP expired or not found. Please request a new one.'
      });
    }

    // Check expiry
    if (Date.now() - storedData.createdAt > OTP_EXPIRY_MS) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.'
      });
    }

    // Check attempts
    if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        error: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (storedData.otp !== otp.trim()) {
      storedData.attempts += 1;
      otpStore.set(otpKey, storedData);

      const remainingAttempts = MAX_OTP_ATTEMPTS - storedData.attempts;
      return res.status(400).json({
        error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
      });
    }

    // OTP verified - clean up
    const savedName = name || storedData.name;
    otpStore.delete(otpKey);

    // Update session with verified phone and name
    if (sessionId) {
      const updateData = {
        phone: cleanPhone,
        verified: true,
        verifiedAt: new Date(),
      };

      if (savedName) updateData.name = savedName;

      await UserSession.findOneAndUpdate(
        { sessionId },
        updateData
      );
    }

    // Generate auth token (simple JWT alternative)
    const token = Buffer.from(JSON.stringify({
      phone: cleanPhone,
      chatbotId,
      verified: true,
      exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    })).toString('base64');

    res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      phone: cleanPhone,
      verified: true,
    });

  } catch (error) {
    logger.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/**
 * POST /auth/resend-otp
 * Resend OTP to user
 */
router.post('/auth/resend-otp', async (req, res) => {
  // Reuse send-otp logic
  return router.handle(req, res, () => {
    req.url = '/auth/send-otp';
  });
});

module.exports = router;
