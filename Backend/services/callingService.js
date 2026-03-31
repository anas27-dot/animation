const axios = require('axios');
const logger = require('../config/logging');
const Chatbot = require('../models/Chatbot');

const CALLING_API_URL = 'https://calling-api.0804.in/api/v1/api/calls';

/**
 * Format phone number to E.164
 * @param {string} phoneNumber 
 * @returns {string}
 */
function formatE164(phoneNumber) {
    if (!phoneNumber) return phoneNumber;

    // Remove all non-numeric characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If it already starts with +, return it
    if (cleaned.startsWith('+')) return cleaned;

    // Default to Indian country code (+91) if it's 10 digits
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }

    // If it starts with 91 and is 12 digits, prepend +
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return `+${cleaned}`;
    }

    // Fallback: just return as is if we can't be sure, 
    // but the API will likely reject it
    return cleaned;
}

/**
 * Initiate a call via the external Calling API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} chatbotId - Chatbot ID to get API key and Agent ID
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function initiateCall(phoneNumber, chatbotId) {
    try {
        const formattedPhone = formatE164(phoneNumber);

        const chatbot = await Chatbot.findById(chatbotId);
        if (!chatbot) {
            return { success: false, error: 'Chatbot not found' };
        }

        const config = chatbot.settings?.calling_tool;
        if (!config || !config.enabled) {
            return { success: false, error: 'Calling tool is not enabled for this chatbot' };
        }

        if (!config.api_key) {
            return { success: false, error: 'Calling tool API key is not configured' };
        }

        const payload = {
            phoneNumber: formattedPhone,
        };

        if (config.agent_id) {
            payload.agentId = config.agent_id;
        }

        logger.info(`📞 [CallingService] Initiating call to ${formattedPhone} (original: ${phoneNumber}) for chatbot ${chatbotId}`);
        logger.debug(`📞 [CallingService] Payload: ${JSON.stringify(payload)}`);

        const response = await axios.post(CALLING_API_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.api_key,
            },
        });

        logger.info(`✅ [CallingService] Call initiated successfully: ${JSON.stringify(response.data)}`);
        return { success: true, data: response.data };
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        logger.error(`❌ [CallingService] Error initiating call: ${errorMessage}`);
        if (error.response) {
            logger.error(`❌ [CallingService] Response status: ${error.response.status}`);
            logger.error(`❌ [CallingService] Response data: ${JSON.stringify(error.response.data)}`);
        }
        return { success: false, error: errorMessage };
    }
}

module.exports = {
    initiateCall,
    formatE164,
};
