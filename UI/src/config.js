/** Omni backend on Render. Legacy Troika host returns 403/CORS from OmniAgentUI — remap at runtime. */
const OMNI_API_BASE = 'https://omniagent-backend.onrender.com/api';

export function normalizeApiBase(raw) {
    if (raw == null || raw === '') return raw;
    let u = String(raw).trim().replace(/\/$/, '');
    if (!u) return u;
    try {
        const { hostname } = new URL(u.includes('://') ? u : `https://${u}`);
        if (hostname === 'chat-api-v4.0804.in') return OMNI_API_BASE;
    } catch {
        /* ignore */
    }
    return u;
}

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

    // API: embed → VITE_* (build-time) → dev /api → Omni default. Legacy 0804.in → OMNI_API_BASE.
    get apiBaseUrl() {
        if (typeof window !== 'undefined' && window.__OMNIAGENT_CONFIG__?.apiBase) {
            return normalizeApiBase(window.__OMNIAGENT_CONFIG__.apiBase);
        }
        const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
        if (fromEnv) return normalizeApiBase(fromEnv.replace(/\/$/, ''));
        if (import.meta.env.DEV) {
            return '/api';
        }
        return OMNI_API_BASE;
    },

    // Feature Flags
    enableTTS: false,
};

export default config;
