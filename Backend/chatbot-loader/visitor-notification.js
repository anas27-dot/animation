/**
 * Visitor Notification Script
 * Add this to your website to automatically notify when visitors arrive
 * 
 * Usage:
 * <script src="https://your-backend.com/chatbot-loader/visitor-notification.js" chatbot-id="YOUR_CHATBOT_ID"></script>
 */

(function() {
  'use strict';
  
  // Get chatbot ID from script tag
  const scriptTag = document.currentScript || document.querySelector('script[chatbot-id]');
  if (!scriptTag) {
    console.warn('Visitor notification: chatbot-id not found');
    return;
  }
  
  const chatbotId = scriptTag.getAttribute('chatbot-id');
  const apiBase = scriptTag.getAttribute('api-base') || 'https://chat-api-v4.0804.in/api';
  
  if (!chatbotId) {
    console.warn('Visitor notification: chatbot-id is required');
    return;
  }
  
  // Track if we've already sent notification for this session
  const notificationKey = `visitor_notified_${chatbotId}`;
  if (sessionStorage.getItem(notificationKey)) {
    return; // Already notified for this session
  }
  
  // Send visitor notification
  try {
    fetch(`${apiBase}/chatbot/${chatbotId}/visitor-arrived`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent || '',
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        sessionStorage.setItem(notificationKey, 'true');
        console.log('Visitor notification sent');
      }
    })
    .catch(error => {
      console.warn('Failed to send visitor notification:', error);
    });
  } catch (error) {
    console.warn('Error sending visitor notification:', error);
  }
})();
