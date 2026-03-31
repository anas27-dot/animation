/**
 * Calendly Service
 * Handles Calendly-related API calls for chatbot UI
 */

import config from '../config';

// API base URL is now dynamically retrieved from config.js getters

/**
 * Get Calendly configuration from chatbot config
 * Calendly config is stored in chatbot.settings.sidebar.calendly
 */
export const getCalendlyConfig = async (chatbotId) => {
    try {
        // Fetch chatbot config which includes sidebar.calendly
        const response = await fetch(`${config.apiBaseUrl}/chatbot/${chatbotId}/config`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-chatbot-id': chatbotId
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch chatbot config');
        }

        const result = await response.json();
        console.log('📅 [Calendly Config] Full config response:', result);
        const sidebarConfig = result.data?.settings?.sidebar || {};
        const calendlyConfig = sidebarConfig.calendly || {};
        console.log('📅 [Calendly Config] Calendly config:', calendlyConfig);
        console.log('📅 [Calendly Config] Calendly enabled:', calendlyConfig.enabled);

        const finalConfig = {
            enabled: calendlyConfig.enabled || false,
            mode: calendlyConfig.mode || 'redirect',
            display_text: calendlyConfig.text || 'Schedule a Meeting',
            url: calendlyConfig.url || '',
            // Add other relevant fields if needed
        };
        console.log('📅 [Calendly Config] Final config:', finalConfig);
        return finalConfig;
    } catch (error) {
        console.error('Error fetching Calendly config:', error);
        return {
            enabled: false,
            mode: 'redirect',
            display_text: 'Schedule a Meeting',
            url: '',
        };
    }
};
