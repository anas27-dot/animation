/**
 * Proposal Service
 * Handles proposal-related API calls for chatbot UI
 */

import config from '../config';

// Helper to get formatted API base
const getApiBase = () => config.apiBaseUrl;

/**
 * Get proposal configuration for sidebar
 */
export const getProposalConfig = async (chatbotId) => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/proposal/${chatbotId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch proposal config');
    }

    const data = await response.json();
    return data.data || {};
  } catch (error) {
    console.error('Error fetching proposal config:', error);
    return {
      enabled: false,
      display_text: 'Get Quote',
      templates: [],
    };
  }
};

/**
 * Get intent configuration
 */
export const getIntentConfig = async (chatbotId) => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/intent/${chatbotId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch intent config');
    }

    const data = await response.json();
    return data.data || {};
  } catch (error) {
    console.error('Error fetching intent config:', error);
    return {
      enabled: false,
      keywords: [],
      confirmation_prompt_text: 'Would you like me to send the proposal to your WhatsApp number?',
      success_message: '✅ Proposal sent to your WhatsApp number!',
      toast_message: 'Proposal sent successfully! 📱',
    };
  }
};

/**
 * Send proposal via WhatsApp
 */
export const sendProposal = async (chatbotId, phone, options = {}) => {
  try {
    const { templateId, templateName, serviceName } = options;

    const response = await fetch(`${config.apiBaseUrl}/proposal/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
      body: JSON.stringify({
        chatbotId,
        phone,
        templateId,
        templateName,
        serviceName: serviceName || 'AI Chat Agent',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send proposal');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending proposal:', error);
    throw error;
  }
};

/**
 * Send proposal from intent flow
 */
export const sendIntentProposal = async (chatbotId, phone, options = {}) => {
  try {
    const { templateName, serviceName } = options;

    const response = await fetch(`${config.apiBaseUrl}/intent/send-proposal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
      body: JSON.stringify({
        chatbotId,
        phone,
        template_name: templateName,
        serviceName: serviceName || 'AI Chat Agent',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send proposal');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending intent proposal:', error);
    throw error;
  }
};

/**
 * Check if message contains proposal intent keywords
 */
export const detectProposalIntent = (message, keywords) => {
  if (!keywords || keywords.length === 0) return false;

  const normalizedMessage = message.toLowerCase().trim();

  return keywords.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim();
    return normalizedMessage.includes(normalizedKeyword) ||
      normalizedMessage === normalizedKeyword;
  });
};

/**
 * Check if response is positive confirmation
 */
export const isPositiveResponse = (message, positiveResponses = []) => {
  const normalizedMessage = message.toLowerCase().trim();
  const defaults = ['yes', 'yep', 'sure', 'ok', 'send it', 'please', 'go ahead', 'yes please'];
  const responses = positiveResponses.length > 0 ? positiveResponses : defaults;

  return responses.some(response => {
    const normalizedResponse = response.toLowerCase();
    return normalizedMessage === normalizedResponse ||
      normalizedMessage.includes(normalizedResponse);
  });
};

/**
 * Check if response is negative
 */
export const isNegativeResponse = (message, negativeResponses = []) => {
  const normalizedMessage = message.toLowerCase().trim();
  const defaults = ['no', 'not now', 'later', 'maybe later', 'not yet'];
  const responses = negativeResponses.length > 0 ? negativeResponses : defaults;

  return responses.some(response => {
    const normalizedResponse = response.toLowerCase();
    return normalizedMessage === normalizedResponse ||
      normalizedMessage.includes(normalizedResponse);
  });
};
