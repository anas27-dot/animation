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

    // API Configuration (priority: embed → VITE_API_BASE_URL → dev proxy → Omni Render default)
    // Production default matches Admin; avoids chat-api-v4.0804.in (403/CORS on OmniAgentUI).
    // Override: set VITE_API_BASE_URL on Render or .env (must include /api). Legacy Troika: set that URL explicitly.
    get apiBaseUrl() {
        if (typeof window !== 'undefined' && window.__OMNIAGENT_CONFIG__?.apiBase) {
            return String(window.__OMNIAGENT_CONFIG__.apiBase).replace(/\/$/, '');
        }
        const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
        if (fromEnv) return fromEnv.replace(/\/$/, '');
        if (import.meta.env.DEV) {
            return '/api';
        }
        return 'https://omniagent-backend.onrender.com/api';
    },

    // Feature Flags
    enableTTS: false,
};

export default config;
