/**
 * Calling Tool Service
 * Handles interaction with the backend calling API
 */

import axios from 'axios';

/**
 * Get calling tool configuration for a chatbot
 * @param {string} apiBase - API base URL
 * @param {string} chatbotId - Chatbot ID
 * @returns {Promise<object>}
 */
export const getCallingConfig = async (apiBase, chatbotId) => {
    try {
        const response = await axios.get(`${apiBase}/calling/${chatbotId}`, {
            headers: { 'x-chatbot-id': chatbotId }
        });
        return response.data.data;
    } catch (error) {
        console.error('Error fetching calling config:', error);
        return null;
    }
};

/**
 * Initiate a call
 * @param {string} apiBase - API base URL
 * @param {string} chatbotId - Chatbot ID
 * @param {string} phoneNumber - User's phone number
 * @returns {Promise<object>}
 */
export const initiateCall = async (apiBase, chatbotId, phoneNumber) => {
    try {
        const response = await axios.post(`${apiBase}/calling/initiate`, {
            chatbotId,
            phoneNumber,
        }, {
            headers: { 'x-chatbot-id': chatbotId }
        });
        return response.data;
    } catch (error) {
        console.error('Error initiating call:', error);
        return { success: false, error: error.response?.data?.error || error.message };
    }
};

/**
 * Check if the user response is positive or negative based on config
 * @param {string} response - User's message
 * @param {object} config - Calling tool config
 * @returns {object} { isPositive: boolean, isNegative: boolean }
 */
export const checkConfirmation = (response, config) => {
    if (!config) return { isPositive: false, isNegative: false };

    const normalizedResponse = response.toLowerCase().trim();
    const positiveResponses = config.positive_responses || [];
    const negativeResponses = config.negative_responses || [];

    const isPositive = positiveResponses.some(r =>
        normalizedResponse === r.toLowerCase() || normalizedResponse.includes(r.toLowerCase())
    );

    const isNegative = negativeResponses.some(r =>
        normalizedResponse === r.toLowerCase() || normalizedResponse.includes(r.toLowerCase())
    );

    return { isPositive, isNegative };
};
