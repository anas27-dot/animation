import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NovaPremiumEnterprise from './components/NovaPremiumEnterprise'
import { TranslationProvider } from './context/TranslationContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

/**
 * Initialize OmniAgent Chatbot in embed mode
 * This function is called by the loader script after the bundle loads
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.chatbotId - The chatbot ID
 * @param {string} config.apiBase - The API base URL
 * @param {string} config.containerId - The container element ID to mount into
 */
function initOmniAgentChatbot(config) {
    const { chatbotId, apiBase, containerId = 'omniagent-chatbot-fullscreen' } = config;

    if (!chatbotId) {
        console.error('❌ OmniAgent Chatbot: chatbotId is required');
        return;
    }

    if (!apiBase) {
        console.error('❌ OmniAgent Chatbot: apiBase is required');
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`❌ OmniAgent Chatbot: Container with id "${containerId}" not found`);
        return;
    }

    console.log('🚀 Initializing OmniAgent Chatbot:', { chatbotId, apiBase, containerId });

    // Store config globally so components can access it
    window.__OMNIAGENT_CONFIG__ = {
        chatbotId,
        apiBase,
        /** When set, NovaPremiumEnterprise avoids document.body scroll lock and portals the mobile drawer to body. */
        embedMode: true,
    };

    // Create root and render
    const root = createRoot(container);

    root.render(
        <StrictMode>
            <TranslationProvider>
                <AuthProvider apiBase={apiBase} chatbotId={chatbotId}>
                    <NovaPremiumEnterprise />
                    <ToastContainer
                        position="top-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="light"
                    />
                </AuthProvider>
            </TranslationProvider>
        </StrictMode>
    );

    console.log('✅ OmniAgent Chatbot initialized successfully');
}

// Expose function on window immediately (this runs when bundle loads)
if (typeof window !== 'undefined') {
    window.initOmniAgentChatbot = initOmniAgentChatbot;
    // Also expose as initTroikaChatbot for backward compatibility with older loader scripts
    window.initTroikaChatbot = initOmniAgentChatbot;
}

// Export as default for UMD bundle
export default initOmniAgentChatbot;
