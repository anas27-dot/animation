/**
 * Email Service
 * Handles email-related API calls for chatbot UI
 */

import config from '../config';

// API base URL is now dynamically retrieved from config.js getters

/**
 * Get email configuration from chatbot config
 * Email config is stored in chatbot.settings.sidebar.email
 */
export const getEmailConfig = async (chatbotId) => {
  try {
    // Fetch chatbot config which includes sidebar.email
    // Use same pattern as component: API_CONFIG.BASE_URL (config.apiBaseUrl)
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
    console.log('📧 [Email Config] Full config response:', result);
    const sidebarConfig = result.data?.settings?.sidebar || {};
    const emailConfig = sidebarConfig.email || {};
    console.log('📧 [Email Config] Sidebar config:', sidebarConfig);
    console.log('📧 [Email Config] Email config:', emailConfig);
    console.log('📧 [Email Config] Email enabled:', emailConfig.enabled);

    // Get email templates
    const templates = await getEmailTemplates(chatbotId);
    console.log('📧 [Email Config] Templates loaded:', templates?.length || 0);

    const finalConfig = {
      enabled: emailConfig.enabled || false,
      mode: emailConfig.mode || 'show_templates',
      display_text: emailConfig.text || 'Send an Email',
      templates: templates || [],
    };
    console.log('📧 [Email Config] Final config:', finalConfig);
    return finalConfig;
  } catch (error) {
    console.error('Error fetching email config:', error);
    return {
      enabled: false,
      mode: 'show_templates',
      display_text: 'Send an Email',
      templates: [],
    };
  }
};

/**
 * Get email templates for a chatbot
 */
export const getEmailTemplates = async (chatbotId) => {
  try {
    // Fetch from email templates endpoint (same base URL pattern)
    const response = await fetch(`${config.apiBaseUrl}/chatbot/${chatbotId}/email-templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
    });

    if (!response.ok) {
      // If endpoint doesn't exist, return empty array
      console.warn('Email templates endpoint not available');
      return [];
    }

    const result = await response.json();
    const templates = result.data?.templates || result.templates || [];
    console.log('📧 [Email Templates] Fetched templates:', {
      count: templates.length,
      templates: templates.map(t => ({
        _id: t._id,
        id: t.id,
        template_name: t.template_name,
        email_subject: t.email_subject,
      })),
    });
    return templates;
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return [];
  }
};

/**
 * Send email with selected template
 */
export const sendEmail = async (chatbotId, templateId, recipientEmail) => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/chatbot/${chatbotId}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
      body: JSON.stringify({
        template_id: templateId,
        recipient_email: recipientEmail,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || 'Failed to send email');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Get email intent configuration for a chatbot
 */
export const getEmailIntentConfig = async (chatbotId) => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/intent/${chatbotId}/email-intent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email intent config');
    }

    const result = await response.json();
    const intentConfig = result.data || result;

    return {
      enabled: intentConfig.enabled || false,
      condition: intentConfig.condition || 'User wants to receive information via email',
      confirmation_prompt_text: intentConfig.confirmation_prompt_text || 'Would you like to receive this via email?',
      template_choice_prompt_text: intentConfig.template_choice_prompt_text || 'Which email template would you like?',
      template_choice_allowlist: intentConfig.template_choice_allowlist || [],
      success_message: intentConfig.success_message || '✅ Email sent successfully!',
      toast_message: intentConfig.toast_message || 'Email sent!',
      prompt_for_template_choice: intentConfig.prompt_for_template_choice !== undefined ? intentConfig.prompt_for_template_choice : true,
      positive_responses: intentConfig.positive_responses || ['yes', 'sure', 'ok', 'send', 'please'],
      negative_responses: intentConfig.negative_responses || ['no', 'cancel', "don't", 'skip'],
    };
  } catch (error) {
    console.error('Error fetching email intent config:', error);
    return {
      enabled: false,
      condition: 'User wants to receive information via email',
      confirmation_prompt_text: 'Would you like to receive this via email?',
      template_choice_prompt_text: 'Which email template would you like?',
      template_choice_allowlist: [],
      success_message: '✅ Email sent successfully!',
      toast_message: 'Email sent!',
      prompt_for_template_choice: true,
      positive_responses: ['yes', 'sure', 'ok', 'send', 'please'],
      negative_responses: ['no', 'cancel', "don't", 'skip'],
    };
  }
};

/**
 * Known 3+ letter TLDs (lowercase). 2-letter TLDs (e.g. .uk, .in) allowed as country codes.
 * Rejects fake TLDs like .cvov.
 */
const KNOWN_TLDS = new Set(
  'com org net edu gov mil int info biz name pro museum aero coop tel travel jobs post asia cat mobi io co ai app dev tech online site store shop blog cloud email company solutions services digital today world life news media social agency studio design photo gallery systems software network global international group partners ventures space xyz icu top win vip work website restaurant realty law medical engineer'.split(/\s+/)
);

/**
 * Validate email format (stricter): structure + TLD allowlist.
 * Rejects e.g. aSzdvfd@shjkds.cvov (.cvov not a known TLD).
 */
export const validateEmail = (email) => {
  if (typeof email !== 'string' || !email) return false;
  const s = email.trim();
  if (s.length > 254) return false;
  const at = s.indexOf('@');
  if (at <= 0 || at !== s.lastIndexOf('@')) return false;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (local.length > 64) return false;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (/^\.|\.$|\.\./.test(local)) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  const labelRe = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  for (const lab of labels) {
    if (!lab || lab.length > 63 || !labelRe.test(lab)) return false;
  }
  const tld = labels[labels.length - 1].toLowerCase();
  if (tld.length === 2) return true;
  return KNOWN_TLDS.has(tld);
};

/**
 * Get custom navigation items for chatbot
 */
export const getCustomNavigationItems = async (chatbotId) => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/chatbot/${chatbotId}/custom-navigation-items`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-chatbot-id': chatbotId
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch custom navigation items');
    }

    const data = await response.json();
    return data.data || { enabled: false, items: [] };
  } catch (error) {
    console.error('Error fetching custom navigation items:', error);
    return { enabled: false, items: [] };
  }
};
