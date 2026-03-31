/**
 * OmniAgent Chatbot Fullscreen Loader
 * 
 * This script creates a fullscreen chatbot interface when embedded in any HTML page.
 * 
 * Usage:
 * <script 
 *   src="https://your-domain.com/chatbot-loader/fullscreen-loader.js"
 *   chatbot-id="YOUR_CHATBOT_ID"
 *   api-base="https://your-api-domain.com/api"
 *   bundle-url="https://your-domain.com/chatbot-loader/chatbot-fullscreen-bundle.js"
 * ></script>
 */

(function () {
  'use strict';

  // Get the current script tag
  const scriptTag = document.currentScript ||
    document.querySelector('script[chatbot-id]') ||
    document.scripts[document.scripts.length - 1];

  if (!scriptTag) {
    console.error('❌ OmniAgent Chatbot Loader: Could not find script tag');
    return;
  }

  // Extract configuration from script tag attributes
  const chatbotId = scriptTag.getAttribute('chatbot-id');
  const apiBase = scriptTag.getAttribute('api-base');
  const bundleUrl = scriptTag.getAttribute('bundle-url') ||
    scriptTag.src.replace('fullscreen-loader.js', 'chatbot-fullscreen-bundle.js');
  const containerId = scriptTag.getAttribute('container-id') || 'omniagent-chatbot-fullscreen';

  // Validate required attributes
  if (!chatbotId) {
    console.error('❌ OmniAgent Chatbot Loader: chatbot-id attribute is required');
    return;
  }

  if (!apiBase) {
    console.error('❌ OmniAgent Chatbot Loader: api-base attribute is required');
    return;
  }

  console.log('🔥 OmniAgent Chatbot Loader started', { chatbotId, apiBase, bundleUrl, containerId });

  // Ensure viewport meta tag is set correctly for mobile
  const ensureViewportMeta = () => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
  };

  ensureViewportMeta();

  // Set CSS custom property for dynamic viewport height
  const updateViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  updateViewportHeight();

  // Create fullscreen container
  const container = document.createElement('div');
  container.id = containerId;

  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100vh;
    height: calc(var(--vh, 1vh) * 100);
    z-index: 9999;
    background: #ffffff;
    overflow: hidden;
    margin: 0;
    padding: 0;
  `;

  // Handle resize
  const handleResize = () => {
    updateViewportHeight();
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));

  // Prevent body scroll
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Append container to body
  document.body.appendChild(container);

  // Load the bundle script
  const bundleScript = document.createElement('script');
  bundleScript.src = bundleUrl;
  bundleScript.async = true;

  bundleScript.onload = function () {
    console.log('✅ OmniAgent Chatbot bundle loaded');

    // Wait for the bundle to initialize
    let attempts = 0;
    const maxAttempts = 50;

    const checkAndInit = setInterval(function () {
      attempts++;

      // Check for init function (supports both OmniAgent and Troika naming)
      const initFn = window.initOmniAgentChatbot || window.initTroikaChatbot;

      if (typeof initFn === 'function') {
        clearInterval(checkAndInit);
        try {
          initFn({
            chatbotId: chatbotId,
            apiBase: apiBase,
            containerId: containerId,
            streamRoute: '/troika/intelligent-chat/stream'
          });
        } catch (error) {
          console.error('❌ OmniAgent Chatbot initialization error:', error);
          showError('Failed to initialize chatbot. Please check the console for details.');
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(checkAndInit);
        console.error('❌ OmniAgent Chatbot: Init function not found after', attempts * 100, 'ms');
        showError('Chatbot bundle loaded but initialization function not found.');
      }
    }, 100);
  };

  bundleScript.onerror = function () {
    console.error('❌ OmniAgent Chatbot: Failed to load bundle from', bundleUrl);
    showError('Failed to load chatbot. Please check the bundle URL.');
  };

  // Load CSS if available
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = bundleUrl.replace('.js', '.css');
  cssLink.onerror = function () {
    console.log('ℹ️ OmniAgent Chatbot: CSS file not found, using inline styles only');
  };
  document.head.appendChild(cssLink);

  // Append bundle script to head
  document.head.appendChild(bundleScript);

  // Error display function
  function showError(message) {
    container.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        flex-direction: column;
        font-family: system-ui, -apple-system, sans-serif;
        color: #dc2626;
        padding: 2rem;
        text-align: center;
      ">
        <h2 style="margin: 0 0 1rem 0; font-size: 1.5rem;">Chatbot Error</h2>
        <p style="margin: 0; font-size: 1rem; max-width: 500px;">${message}</p>
        <button 
          onclick="
            var container = document.getElementById('${containerId}');
            if (container) {
              container.remove();
              document.body.style.overflow = '${originalOverflow || ''}';
              document.documentElement.style.overflow = '';
            }
          "
          style="
            margin-top: 1.5rem;
            padding: 0.75rem 1.5rem;
            background: #dc2626;
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
          "
        >
          Close
        </button>
      </div>
    `;
  }

  // Cleanup function
  window.removeOmniAgentChatbot = function () {
    const containerElement = document.getElementById(containerId);
    if (containerElement) {
      containerElement.remove();
      document.body.style.overflow = originalOverflow || '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('resize', handleResize);
      console.log('✅ OmniAgent Chatbot removed');
    }
  };

})();
