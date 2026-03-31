const logger = require('../config/logging');
const { extractTextFromQuery } = require('../utils/textExtractor');
const Chatbot = require('../models/Chatbot');

// Intent keywords mapping
const INTENT_KEYWORDS = {
  product_inquiry: [
    'product', 'products', 'offer', 'offering', 'sell', 'selling',
    'catalog', 'catalogue', 'item', 'items', 'what do you sell',
    'what products', 'what services',
  ],
  pricing_question: [
    'price', 'pricing', 'cost', 'costs', 'how much', 'fee', 'fees',
    'charge', 'charges', 'expensive', 'cheap', 'affordable',
    'discount', 'discounts', 'deal', 'deals',
  ],
  booking_request: [
    'book', 'booking', 'schedule', 'appointment', 'meeting',
    'calendar', 'available', 'availability', 'time slot',
    'reserve', 'reservation',
  ],
  support_request: [
    'help', 'support', 'issue', 'problem', 'error', 'bug',
    'not working', 'broken', 'fix', 'troubleshoot',
    'how to', 'how do i', 'stuck',
  ],
  lead_capture: [
    'contact you', 'reach out', 'get in touch', 'speak to', 'talk to',
    'sales person', 'salesperson', 'representative', 'demo', 'trial',
    'interested in buying', 'more information about products',
  ],
};

async function detectIntent(message) {
  try {
    // Extract text content from multimodal input (handles both strings and Vision API arrays)
    const textToProcess = extractTextFromQuery(message);
    const lowerMessage = textToProcess.toLowerCase();
    const intentScores = {};

    // Calculate scores for each intent
    Object.keys(INTENT_KEYWORDS).forEach((intent) => {
      const keywords = INTENT_KEYWORDS[intent];
      let score = 0;

      keywords.forEach((keyword) => {
        if (lowerMessage.includes(keyword)) {
          score += 1;
        }
      });

      intentScores[intent] = score;
    });

    // Find intent with highest score
    const maxScore = Math.max(...Object.values(intentScores));

    if (maxScore === 0) {
      return 'general_query';
    }

    const detectedIntent = Object.keys(intentScores).find(
      (intent) => intentScores[intent] === maxScore
    );

    return detectedIntent || 'general_query';
  } catch (error) {
    logger.error('Intent detection error:', error);
    return 'general_query';
  }
}

/**
 * Detect if user message contains proposal intent keywords
 * @param {string} message - User message
 * @param {string} chatbotId - Chatbot ID
 * @returns {Promise<{detected: boolean, keyword?: string, confidence?: number}>}
 */
async function detectProposalIntent(message, chatbotId) {
  try {
    // Get chatbot and intent configuration
    const chatbot = await Chatbot.findById(chatbotId).lean();

    if (!chatbot || !chatbot.settings?.intentEnabled) {
      return { detected: false };
    }

    const keywords = chatbot.settings?.intentKeywords || [];
    if (!keywords || keywords.length === 0) {
      return { detected: false };
    }

    // Normalize message for matching
    const normalizedMessage = message.toLowerCase().trim();

    // Check for keyword matches
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();

      // Exact match
      if (normalizedMessage === normalizedKeyword) {
        logger.info(`✅ Proposal intent detected: Exact match with "${keyword}"`);
        return {
          detected: true,
          keyword: keyword,
          confidence: 1.0
        };
      }

      // Contains match
      if (normalizedMessage.includes(normalizedKeyword)) {
        logger.info(`✅ Proposal intent detected: Contains "${keyword}"`);
        return {
          detected: true,
          keyword: keyword,
          confidence: 0.8
        };
      }
    }

    return { detected: false };
  } catch (error) {
    logger.error(`❌ Intent detection error: ${error.message}`);
    return { detected: false };
  }
}

/**
 * Check if user response is a positive confirmation
 * @param {string} message - User message
 * @param {string} chatbotId - Chatbot ID
 * @returns {Promise<{isPositive: boolean, isNegative: boolean}>}
 */
async function checkConfirmationResponse(message, chatbotId) {
  try {
    const chatbot = await Chatbot.findById(chatbotId).lean();

    if (!chatbot) {
      return { isPositive: false, isNegative: false };
    }

    const normalizedMessage = message.toLowerCase().trim();

    // Check positive responses
    const positiveResponses = chatbot.settings?.intentPositiveResponses ||
      ['yes', 'yep', 'sure', 'ok', 'send it', 'please', 'go ahead', 'yes please'];
    for (const response of positiveResponses) {
      if (normalizedMessage === response.toLowerCase() ||
        normalizedMessage.includes(response.toLowerCase())) {
        return { isPositive: true, isNegative: false };
      }
    }

    // Check negative responses
    const negativeResponses = chatbot.settings?.intentNegativeResponses ||
      ['no', 'not now', 'later', 'maybe later', 'not yet'];
    for (const response of negativeResponses) {
      if (normalizedMessage === response.toLowerCase() ||
        normalizedMessage.includes(response.toLowerCase())) {
        return { isPositive: false, isNegative: true };
      }
    }

    return { isPositive: false, isNegative: false };
  } catch (error) {
    logger.error(`❌ Confirmation check error: ${error.message}`);
    return { isPositive: false, isNegative: false };
  }
}

/**
 * Get intent configuration for chatbot
 * @param {string} chatbotId - Chatbot ID
 * @returns {Promise<object|null>}
 */
async function getIntentConfig(chatbotId) {
  try {
    const chatbot = await Chatbot.findById(chatbotId).lean();
    if (!chatbot) return null;

    return {
      enabled: chatbot.settings?.intentEnabled || false,
      keywords: chatbot.settings?.intentKeywords || [], // Keep for backward compatibility
      proposal_condition: chatbot.settings?.proposal_condition ||
        'User is asking for a proposal, quote, pricing, or wants to see costs',
      proposal_campaign_name: chatbot.settings?.proposal_campaign_name || '',
      proposal_template_name: chatbot.settings?.proposal_template_name || null,
      confirmation_prompt_text: chatbot.settings?.intentConfirmationText ||
        'Would you like me to send the proposal to your WhatsApp number?',
      template_choice_prompt_text: chatbot.settings?.intentTemplateChoiceText ||
        'Which proposal would you like me to send?',
      template_choice_allowlist: chatbot.settings?.intentTemplateAllowlist || [],
      success_message: chatbot.settings?.intentSuccessMessage ||
        '✅ Proposal sent to your WhatsApp number!',
      toast_message: chatbot.settings?.intentToastMessage ||
        'Proposal sent successfully! 📱',
      prompt_for_template_choice: chatbot.settings?.intentPromptForChoice || false,
      media: chatbot.settings?.intentMedia || {},
      positive_responses: chatbot.settings?.intentPositiveResponses ||
        ['yes', 'yep', 'sure', 'ok', 'send it', 'please', 'go ahead', 'yes please'],
      negative_responses: chatbot.settings?.intentNegativeResponses ||
        ['no', 'not now', 'later', 'maybe later', 'not yet'],
      timeout_minutes: chatbot.settings?.intentTimeoutMinutes || 5,
    };
  } catch (error) {
    logger.error(`❌ Error getting intent config: ${error.message}`);
    return null;
  }
}

module.exports = {
  detectIntent,
  INTENT_KEYWORDS,
  detectProposalIntent,
  checkConfirmationResponse,
  getIntentConfig,
};

