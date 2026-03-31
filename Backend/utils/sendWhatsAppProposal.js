// utils/sendWhatsAppProposal.js
// Send service proposal via WhatsApp using AiSensy API

const axios = require('axios');
const logger = require('../config/logging');

/**
 * Normalize phone number to international format
 * @param {string} phoneRaw - Raw phone number
 * @param {string} countryCode - Country code (default: "91")
 * @returns {object} - { valid: boolean, normalized?: string, error?: string }
 */
function normalizePhoneNumber(phoneRaw, countryCode = '91') {
  if (!phoneRaw) {
    return { valid: false, error: 'Phone number is required' };
  }

  // Extract digits only
  let digits = String(phoneRaw).replace(/\D/g, '');

  // If longer than 12, try to capture last 10
  if (digits.length > 12 && /\d{10}$/.test(digits)) {
    digits = digits.slice(-10);
  }

  // Build destination
  let destination = '';
  if (digits.length === 10) {
    destination = `${countryCode}${digits}`;
  } else if (digits.length === 12 && digits.startsWith(countryCode)) {
    destination = digits;
  } else {
    return { valid: false, error: 'Invalid phone number format. Expected 10 digits or 12 digits with country code.' };
  }

  return { valid: true, normalized: destination };
}

/**
 * Normalize media object
 */
function normalizeMedia(media) {
  if (!media || typeof media !== 'object') return {};
  const url = typeof media.url === 'string' ? media.url.trim() : null;
  const filename = typeof media.filename === 'string' ? media.filename.trim() : null;
  const normalized = {};
  if (url) normalized.url = url;
  if (filename) normalized.filename = filename;
  return normalized;
}

/**
 * Send WhatsApp proposal
 * @param {object} params - Parameters for sending proposal
 * @param {string} params.phone - Phone number
 * @param {string} params.serviceName - Service name
 * @param {string} params.campaignName - Campaign name
 * @param {string} params.templateName - Template name (optional)
 * @param {array} params.templateParams - Template parameters (optional)
 * @param {object} params.media - Media attachment { url, filename } (optional)
 * @param {string} params.apiKey - AISensy API key
 * @param {string} params.orgSlug - AISensy org slug
 * @param {string} params.senderName - Sender name
 * @param {string} params.countryCode - Country code
 * @returns {Promise<object>} - Result object with ok, status, data, or error
 */
async function sendWhatsAppProposal({
  phone,
  serviceName = 'AI Chat Agent',
  campaignName,
  templateName,
  templateParams = [],
  media,
  apiKey,
  orgSlug = 'troika-tech-services',
  senderName = 'Troika Tech Services',
  countryCode = '91',
}) {
  // Validate API key
  if (!apiKey) {
    logger.error('Missing AISENSY_API_KEY');
    return { ok: false, error: 'WhatsApp API configuration missing' };
  }

  // Validate campaign name
  if (!campaignName) {
    return { ok: false, error: 'Campaign name is required' };
  }

  // Normalize phone number
  const phoneResult = normalizePhoneNumber(phone, countryCode);
  if (!phoneResult.valid) {
    logger.warn(`Phone normalization failed: ${phoneResult.error}`);
    return { ok: false, error: phoneResult.error };
  }

  const destination = phoneResult.normalized;

  // Build payload matching AISensy API structure
  const payload = {
    apiKey,
    campaignName,
    destination,
    userName: senderName,
    templateParams: templateParams || [],
    source: 'chatbot-proposal',
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
  };

  // Add template name if provided
  if (templateName) {
    payload.templateName = templateName;
  }

  // Attach media if provided
  const normalizedMedia = normalizeMedia(media);
  if (normalizedMedia.url) {
    payload.media = {
      url: normalizedMedia.url,
      filename: normalizedMedia.filename || undefined,
    };
  }

  logger.info(`📤 Sending proposal:`, {
    campaignName,
    templateName: templateName || 'not specified',
    destination: destination.substring(0, 4) + '****',
  });

  const url = `https://backend.api-wa.co/campaign/${orgSlug}/api/v2`;

  try {
    logger.info(`📤 Sending proposal for "${serviceName}" to ${destination}`);

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    logger.info(`✅ Proposal sent successfully to ${destination}`);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message = data?.message || err.message;

    logger.error('❌ WhatsApp proposal send error:', {
      status,
      message,
      data,
      destination,
      serviceName,
    });

    return {
      ok: false,
      status,
      error: message,
      data,
    };
  }
}

module.exports = sendWhatsAppProposal;
