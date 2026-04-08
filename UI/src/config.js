const config = {
    // Chatbot Configuration (priority: embed → Vite env → default)
    get chatbotId() {
        if (typeof window !== 'undefined' && window.__OMNIAGENT_CONFIG__?.chatbotId) {
            return window.__OMNIAGENT_CONFIG__.chatbotId;
        }
        const fromEnv = import.meta.env.VITE_CHATBOT_ID;
        if (fromEnv) return fromEnv;
        return '69d4dd3255a54826a50b47f7';
    },

    // API Configuration (priority: embed → env → dev localhost → production)
    get apiBaseUrl() {
        if (typeof window !== 'undefined' && window.__OMNIAGENT_CONFIG__?.apiBase) {
            return window.__OMNIAGENT_CONFIG__.apiBase;
        }
        if (import.meta.env.VITE_USE_LIVE_API === 'true') {
            return 'https://chat-api-v4.0804.in/api';
        }
        const fromEnv = import.meta.env.VITE_API_BASE_URL;
        if (fromEnv) return fromEnv;
        // Vite dev: use same-origin /api so vite.config.js proxy forwards to localhost:5000 (avoids CORS / blocked cross-port fetch).
        if (import.meta.env.DEV) {
            return '/api';
        }
        return 'https://chat-api-v4.0804.in/api';
    },

    // Feature Flags
    enableTTS: false,
};

export default config;
