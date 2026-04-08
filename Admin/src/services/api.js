import axios from "axios";

import { API_BASE_URL } from "../config";

const api = axios.create({
  // Development: Use localhost backend
  baseURL: API_BASE_URL,
  // Production: "https://chat-apiv3.0804.in/api",
  withCredentials: true,
});

// ✅ Automatically attach token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Handle 401 and 403 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check multiple possible locations for error message
    const errorMessage = error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "";

    const isDeactivationError = errorMessage.toLowerCase().includes("deactivated") ||
      errorMessage.toLowerCase().includes("inactive") ||
      errorMessage.toLowerCase().includes("all chatbots are currently inactive") ||
      errorMessage.toLowerCase().includes("currently inactive");

    console.log("🔍 [API INTERCEPTOR] Error check:", {
      status: error.response?.status,
      message: errorMessage,
      isDeactivationError
    });

    if (error.response?.status === 401) {
      const reqUrl = error.config?.url || "";
      const isAuthLogin =
        reqUrl.includes("/admin/login") || reqUrl.includes("/user/login");

      // Check if it's a deactivation error (backend returns 401 for deactivated accounts)
      if (isDeactivationError) {
        console.error("🔴 [API INTERCEPTOR] 401 Unauthorized - Account deactivated");
        console.error("🔴 [API INTERCEPTOR] Error message:", errorMessage);
        console.error("🔴 [API INTERCEPTOR] Full error response:", error.response?.data);
        console.error("🔴 [API INTERCEPTOR] Current pathname:", window.location.pathname);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        // Only redirect if we're not already on the deactivated page or login page
        // If on login page, let LoginPage handle the redirect
        if (window.location.pathname !== "/account-deactivated" && window.location.pathname !== "/") {
          console.log("🔴 [API INTERCEPTOR] Redirecting to /account-deactivated");
          window.location.href = "/account-deactivated";
        } else {
          console.log("🔴 [API INTERCEPTOR] On login page, letting LoginPage handle redirect");
        }
      } else if (isAuthLogin) {
        // Wrong password / unknown user — not a stale JWT
        console.error(
          "401 Unauthorized on login — invalid email or password (or wrong API server)"
        );
      } else {
        console.error("401 Unauthorized - Token expired or invalid");
        localStorage.removeItem("token");
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
          window.location.href = "/";
        }
      }
    } else if (error.response?.status === 403) {
      // Check if it's an account deactivation error
      if (isDeactivationError) {
        console.error("403 Forbidden - Account deactivated");
        localStorage.removeItem("token");
        // Only redirect if we're not already on the deactivated page
        if (window.location.pathname !== "/account-deactivated") {
          window.location.href = "/account-deactivated";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const fetchClientConfig = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/config`);
};

export const updateClientConfig = (chatbotId, config) => {
  return api.put(`/chatbot/${chatbotId}/config`, config);
};

// Customization API endpoints
export const fetchCustomization = (chatbotId) => {
  return api.get(`/customizations/${chatbotId}`);
};

export const updateCustomization = (chatbotId, customization) => {
  return api.put(`/customizations/${chatbotId}`, customization);
};

export const resetCustomization = (chatbotId) => {
  return api.post(`/customizations/${chatbotId}/reset`);
};

// User Dashboard API endpoints
export const userLogin = (credentials) => {
  return api.post('/user/login', credentials);
};

export const fetchUserCompany = () => {
  return api.get('/user/company');
};

export const fetchUserUsage = () => {
  return api.get('/user/usage');
};

export const fetchChatbotSubscription = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/subscription`);
};

export const fetchUserMessages = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  return api.get(`/user/messages?${queryParams.toString()}`);
};

export const fetchUniqueEmailsAndPhones = () => {
  return api.get('/user/messages/unique-emails-and-phones');
};

export const fetchUserSessions = (params = {}) => {
  console.log("🔍 fetchUserSessions API function called");
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  const queryString = queryParams.toString();
  return api.get(`/user/sessions${queryString ? `?${queryString}` : ''}`);
};

export const fetchUserAnalytics = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  const queryString = queryParams.toString();
  return api.get(`/user/analytics${queryString ? `?${queryString}` : ''}`);
};

export const fetchUserLeads = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  const queryString = queryParams.toString();
  return api.get(`/user/leads${queryString ? `?${queryString}` : ''}`);
};

export const fetchCollectedLeads = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  const queryString = queryParams.toString();
  return api.get(`/user/collected-leads${queryString ? `?${queryString}` : ''}`);
};

export const fetchTopUsers = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  const queryString = queryParams.toString();
  return api.get(`/user/top-users${queryString ? `?${queryString}` : ''}`);
};

export const fetchUserChatHistory = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  const queryString = queryParams.toString();
  return api.get(`/user/chat-history${queryString ? `?${queryString}` : ''}`);
};

// Admin API endpoints
export const adminLogin = (credentials) => {
  return api.post('/admin/login', credentials);
};

export const fetchAdminStats = () => {
  return api.get('/admin/stats');
};

export const fetchAllAdmins = () => {
  return api.get('/admin/all');
};

export const createAdmin = (adminData) => {
  return api.post('/admin/create', adminData);
};

export const deleteAdmin = (adminId) => {
  return api.delete(`/admin/delete/${adminId}`);
};

export const toggleAdminRole = (adminId) => {
  return api.put(`/admin/toggle-role/${adminId}`);
};

// Company Management API endpoints
export const fetchCompanies = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  return api.get(`/companies?${queryParams.toString()}`);
};

export const fetchCompaniesWithChatbots = () => {
  return api.get('/company/all');
};

export const updateCompanyManagedByName = (companyId, managedByName) => {
  return api.put(`/company/update/${companyId}`, { managed_by_name: managedByName });
};

export const createCompany = (companyData) => {
  return api.post('/companies', companyData);
};

export const updateCompany = (companyId, companyData) => {
  return api.put(`/companies/${companyId}`, companyData);
};

export const deleteCompany = (companyId) => {
  return api.delete(`/companies/${companyId}`);
};

// Company Credit Management
export const assignCompanyCredits = (companyId, credits, reason) => {
  return api.post(`/company/${companyId}/credits`, { credits, reason });
};

export const getCompanyCreditBalance = (companyId) => {
  return api.get(`/company/${companyId}/credits`);
};

export const getCompanyCreditHistory = (companyId) => {
  return api.get(`/company/${companyId}/credits/history`);
};

export const addCompanyCredits = (companyId, credits, duration, reason) => {
  console.log('📡 [API] addCompanyCredits sending - companyId:', companyId, 'credits:', credits, 'duration:', duration, 'reason:', reason);

  const payload = { credits, reason };
  if (duration !== undefined) {
    payload.duration = duration;
  }

  return api.post(`/company/${companyId}/credits/add`, payload);
};

export const removeCompanyCredits = (companyId, credits, duration) => {
  const payload = { credits };
  if (duration !== undefined) {
    payload.duration = duration;
  }
  return api.post(`/company/${companyId}/credits/remove`, payload);
};

// Chatbot Management API endpoints
export const fetchChatbots = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  // Backend route is /api/chatbot/all (singular)
  const queryString = queryParams.toString();
  return api.get(`/chatbot/all${queryString ? `?${queryString}` : ''}`);
};

export const createChatbot = (chatbotData) => {
  // Backend route is /api/chatbot/create (singular)
  return api.post('/chatbot/create', chatbotData);
};

export const updateChatbot = (chatbotId, chatbotData) => {
  return api.put(`/chatbots/${chatbotId}`, chatbotData);
};

export const updateChatbotStatus = (chatbotId, status) => {
  return api.put(`/chatbot/edit/${chatbotId}`, { status });
};

export const deleteChatbot = (chatbotId) => {
  return api.delete(`/chatbots/${chatbotId}`);
};

export const fetchChatbotDetails = (chatbotId) => {
  return api.get(`/chatbots/${chatbotId}`);
};

// Authentication Configuration API endpoints
export const getAuthConfig = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/auth-config`);
};

export const getAuthConfigAdmin = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/config`).then(response => {
    const settings = response.data.data?.settings || {};
    return {
      data: {
        auth_enabled: settings.authentication?.isEnabled || false,
      }
    };
  });
};

export const updateAuthConfig = (chatbotId, config) => {
  // Support both isEnabled (from state) and auth_enabled (legacy)
  const isEnabled = config.isEnabled !== undefined ? config.isEnabled : config.auth_enabled;

  return api.put(`/chatbot/${chatbotId}/config`, {
    settings: {
      authentication: {
        ...config,
        isEnabled: isEnabled
      }
    }
  });
};

// Message History API endpoints
export const fetchMessageHistory = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  return api.get(`/messages?${queryParams.toString()}`);
};

export const fetchMessageHistoryBySession = (sessionId) => {
  return api.get(`/messages/session/${sessionId}`);
};

// Download/Export API endpoints
export const downloadUserData = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  return api.get(`/user/download-data?${queryParams.toString()}`, {
    responseType: 'blob'
  });
};

export const downloadUserReport = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      queryParams.append(key, params[key]);
    }
  });
  return api.get(`/user/download-report?${queryParams.toString()}`, {
    responseType: 'blob'
  });
};

// Chatbot UI Configuration API endpoints
export const getChatbotUIConfig = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/config`);
};

export const updateChatbotUIAvatar = (chatbotId, avatarUrl) => {
  return api.put(`/chatbot/${chatbotId}/config`, { settings: { avatar_url: avatarUrl } });
};

export const updateChatbotUIWelcomeText = (chatbotId, welcomeText, welcomeTextEnabled = true, welcomeRotatingTwoLines = true) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/text`, {
    welcome_text: welcomeText,
    welcome_text_enabled: welcomeTextEnabled,
    welcome_rotating_two_lines: welcomeRotatingTwoLines
  });
};

export const updateChatbotUIAssistantHeader = (chatbotId, assistantDisplayName, assistantLogoUrl) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/assistant`, {
    assistant_display_name: assistantDisplayName || null,
    assistant_logo_url: assistantLogoUrl || null,
    assistant_subtitle: null,
  });
};

export const updateChatbotUITabConfig = (chatbotId, tabTitle, faviconUrl) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/tab`, {
    tab_title: tabTitle || null,
    favicon_url: faviconUrl || null,
  });
};

export const updateChatbotUIInputPlaceholders = (chatbotId, placeholdersEnabled, placeholders, placeholderSpeed, placeholderAnimation) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/placeholders`, {
    placeholders_enabled: placeholdersEnabled,
    placeholders: placeholders,
    placeholder_speed: placeholderSpeed,
    placeholder_animation: placeholderAnimation,
  });
};

export const updateChatbotUIContact = (chatbotId, whatsappNumber, callNumber) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/contact`, {
    whatsapp_number: whatsappNumber,
    call_number: callNumber,
  });
};

export const updateChatbotUIChatBackground = (chatbotId, payload) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/background`, {
    enabled: payload.enabled,
    image_url: payload.image_url,
    opacity: payload.opacity,
    style: payload.style,
  });
};

export const getChatBackgroundUploadUrl = (chatbotId, filename, contentType) => {
  return api.post(`/chatbot/${chatbotId}/chat-background/upload-url`, { filename, contentType });
};

/** Multipart upload to API disk (no S3). Field name: `file`. */
export const uploadChatBackgroundFile = (chatbotId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/chatbot/${chatbotId}/chat-background/upload`, formData);
};

// WhatsApp Proposal Template API endpoints
export const getWhatsAppProposalTemplates = (chatbotId) => {
  return api.get(`/proposal/${chatbotId}/templates`).then(response => ({
    data: response.data?.data || []
  }));
};

export const createWhatsAppProposalTemplate = (chatbotId, templateData) => {
  return api.post(`/proposal/${chatbotId}/templates`, templateData);
};

export const updateWhatsAppProposalTemplate = (chatbotId, templateId, templateData) => {
  return api.put(`/proposal/${chatbotId}/templates/${templateId}`, templateData);
};

export const deleteWhatsAppProposalTemplate = (chatbotId, templateId) => {
  return api.delete(`/proposal/${chatbotId}/templates/${templateId}`);
};

export const updateWhatsAppProposalSettings = (chatbotId, enabled, displayText, defaultApiKey, defaultOrgSlug, defaultSenderName, defaultCountryCode) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/whatsapp-proposal`, {
    enabled,
    display_text: displayText,
    default_api_key: defaultApiKey,
    default_org_slug: defaultOrgSlug,
    default_sender_name: defaultSenderName,
    default_country_code: defaultCountryCode,
  });
};

// Sidebar Configuration API endpoints
export const getChatbotSidebarConfig = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/sidebar-config`);
};

export const updateChatbotSidebarEnabled = (chatbotId, enabled) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/enabled`, { enabled });
};

// User dashboard sidebar permissions (controls user dashboard menus)
export const updateChatbotUserDashboardSidebar = (chatbotId, enabled, allowedMenuKeys = []) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/user-dashboard`, {
    enabled,
    allowed_menu_keys: allowedMenuKeys,
  });
};

// Profanity Management APIs
export const getProfanityConfig = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/profanity-config`);
};

export const updateProfanityConfig = (chatbotId, enabled, customKeywords, showInUserDashboard) => {
  return api.put(`/chatbot/${chatbotId}/profanity-config`, {
    enabled,
    custom_keywords: customKeywords,
    show_in_user_dashboard: showInUserDashboard,
  });
};

export const getBannedSessions = (chatbotId, params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.search) queryParams.append('search', params.search);
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);

  const queryString = queryParams.toString();
  return api.get(`/chatbot/${chatbotId}/banned-sessions${queryString ? `?${queryString}` : ''}`);
};

export const unbanSession = (chatbotId, banId) => {
  return api.post(`/chatbot/${chatbotId}/banned-sessions/${banId}/unban`);
};

export const bulkUnbanSessions = (chatbotId, banIds) => {
  return api.post(`/chatbot/${chatbotId}/banned-sessions/bulk-unban`, {
    ban_ids: banIds,
  });
};

// Offer Template APIs - Global/Universal (no chatbot ID needed)
export const getOfferSidebarConfig = () => {
  return api.get(`/chatbot/offer-templates/sidebar-config`);
};

export const updateOfferSidebarConfig = (enabled, displayText) => {
  return api.put(`/chatbot/offer-templates/sidebar-config`, {
    enabled,
    display_text: displayText,
  });
};

export const getOfferTemplates = () => {
  return api.get(`/chatbot/offer-templates`);
};

export const getOfferTemplate = (templateId) => {
  return api.get(`/chatbot/offer-templates/${templateId}`);
};

export const createOfferTemplate = (templateData) => {
  return api.post(`/chatbot/offer-templates`, templateData);
};

export const updateOfferTemplate = (templateId, templateData) => {
  return api.put(`/chatbot/offer-templates/${templateId}`, templateData);
};

export const deleteOfferTemplate = (templateId) => {
  return api.delete(`/chatbot/offer-templates/${templateId}`);
};

export const updateChatbotSidebarWhatsApp = (chatbotId, enabled, mode, url, text) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/whatsapp`, {
    enabled,
    mode,
    url,
    text,
  });
};

export const updateChatbotSidebarCall = (chatbotId, enabled, mode, number, text) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/call`, {
    enabled,
    mode,
    number,
    text,
  });
};

export const updateChatbotSidebarCalendly = (
  chatbotId,
  enabled,
  mode,
  url,
  text,
  pat,
  eventTypeUri
) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/calendly`, {
    enabled,
    mode,
    url,
    text,
    pat,
    eventTypeUri,
  });
};

export const updateChatbotSidebarEmail = (chatbotId, enabled, mode, text) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/email`, {
    enabled,
    mode,
    text,
  });
};

// Skater Girl Configuration
export const updateChatbotSkaterGirl = (chatbotId, enabled, messages) => {
  return api.put(`/chatbot/${chatbotId}/ui-config/skater-girl`, {
    enabled,
    messages,
  });
};

// Embed Script API endpoint
export const getEmbedScript = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/embed-script`);
};

// Intent Config API endpoints
export const getIntentConfig = (chatbotId) => {
  return api.get(`/intent/${chatbotId}`);
};

export const getIntentConfigAdmin = (chatbotId) => {
  return api.get(`/intent/${chatbotId}`).then(response => {
    // Transform public config to admin config format
    const data = response.data?.data || response.data || {};
    return {
      data: {
        enabled: data.enabled || false,
        keywords: data.keywords || ['proposal', 'quote', 'pricing', 'quotation', 'estimate'],
        proposal_condition: data.proposal_condition || "User is asking for a proposal, quote, pricing, or wants to see costs",
        proposal_template_name: data.proposal_template_name || "",
        proposal_campaign_name: data.proposal_campaign_name || "",
        confirmation_prompt_text: data.confirmation_prompt_text || "Would you like me to send the proposal to your WhatsApp number?",
        template_choice_prompt_text: data.template_choice_prompt_text || "Which proposal should I send?",
        template_choice_allowlist: data.template_choice_allowlist || [],
        success_message: data.success_message || "✅ Proposal sent to your WhatsApp number!",
        toast_message: data.toast_message || "Proposal sent successfully! 📱",
        prompt_for_template_choice: data.prompt_for_template_choice || false,
        media: data.media || { url: "", filename: "" },
        positive_responses: data.positive_responses || ["yes", "yep", "sure", "ok", "send it", "please", "go ahead", "yes please"],
        negative_responses: data.negative_responses || ["no", "not now", "later", "maybe later", "not yet"],
        timeout_minutes: data.timeout_minutes || 5,
      }
    };
  });
};

export const updateIntentConfig = (chatbotId, config) => {
  return api.put(`/intent/${chatbotId}`, config);
};

// Email Intent Config API endpoints
export const getEmailIntentConfigAdmin = (chatbotId) => {
  return api.get(`/intent/${chatbotId}/email-intent`).then(response => {
    const data = response.data?.data || response.data || {};
    return {
      data: {
        enabled: data.enabled || false,
        condition: data.condition || 'User wants to receive information via email',
        confirmation_prompt_text: data.confirmation_prompt_text || 'Would you like to receive this via email?',
        template_choice_prompt_text: data.template_choice_prompt_text || 'Which email template would you like?',
        template_choice_allowlist: data.template_choice_allowlist || [],
        success_message: data.success_message || '✅ Email sent successfully!',
        toast_message: data.toast_message || 'Email sent!',
        prompt_for_template_choice: data.prompt_for_template_choice !== undefined ? data.prompt_for_template_choice : true,
        positive_responses: data.positive_responses || ['yes', 'sure', 'ok', 'send', 'please'],
        negative_responses: data.negative_responses || ['no', 'cancel', "don't", 'skip'],
      }
    };
  });
};

export const updateEmailIntentConfig = (chatbotId, config) => {
  return api.put(`/intent/${chatbotId}/email-intent`, config);
};

// Handoff intent config (separate from proposals)
export const getHandoffConfigAdmin = (chatbotId) => {
  // Return mock data since endpoint doesn't exist
  return Promise.resolve({
    data: {
      enabled: false,
      trigger_keywords: ['human', 'agent', 'help', 'support'],
      auto_trigger_message_count: 10,
      confirmation_message: 'Would you like to speak with a human agent?',
      transfer_message: 'Connecting you to a human agent...',
      unavailable_message: 'All agents are currently busy. Please try again later.',
      working_hours: { enabled: false, timezone: 'UTC', schedule: [] }
    }
  });
};

export const updateHandoffConfig = (chatbotId, config) => {
  return api.put(`/handoff/config/${chatbotId}`, config);
};

export const sendProposal = (chatbotId, phone, serviceName) => {
  return api.post(`/intent/send-proposal`, {
    chatbotId,
    phone,
    serviceName,
  });
};

// Zoho CRM Integration API endpoints
export const getZohoConfigAdmin = (chatbotId) => {
  // Return mock data since endpoint doesn't exist
  return Promise.resolve({
    data: {
      enabled: false,
      client_id: '',
      client_secret: '',
      region: 'com',
      module: 'Leads',
      field_mappings: {
        name_field: 'First_Name',
        phone_field: 'Phone',
        email_field: 'Email',
        company_field: 'Company',
        source_field: 'Lead_Source',
        description_field: 'Description'
      },
      auto_create: false,
      duplicate_check: true
    }
  });
};

export const updateZohoConfig = (chatbotId, config) => {
  return api.put(`/zoho/${chatbotId}`, config);
};

export const testZohoConnection = (chatbotId) => {
  return api.post(`/zoho/${chatbotId}/test-connection`);
};

export const getZohoAuthorizationUrl = (chatbotId, region, clientId) => {
  const params = {};
  if (region) {
    params.region = region;
  }
  if (clientId && clientId.trim()) {
    params.clientId = clientId.trim();
  }
  console.log('🔍 [Zoho Auth] Request params:', { chatbotId, region, clientId: clientId ? '***' + clientId.slice(-10) : 'none', params });
  return api.get(`/zoho/${chatbotId}/authorization-url`, {
    params
  });
};

export const exchangeZohoCodeForToken = (chatbotId, code, region) => {
  return api.post(`/zoho/${chatbotId}/exchange-code`, {
    code,
    region
  });
};

// Transcript Config API endpoints
export const getTranscriptConfig = (chatbotId) => {
  // Return mock data since endpoint doesn't exist
  return Promise.resolve({
    data: {
      enabled: false,
      auto_send: false,
      email_recipients: [],
      include_attachments: true,
      custom_subject: 'Chat Transcript',
      custom_message: 'Please find the chat transcript attached.'
    }
  });
};

export const getTranscriptConfigAdmin = (chatbotId) => {
  // Return mock data since endpoint doesn't exist
  return Promise.resolve({
    data: {
      enabled: false,
      auto_send: false,
      email_recipients: [],
      include_attachments: true,
      custom_subject: 'Chat Transcript',
      custom_message: 'Please find the chat transcript attached.',
      trigger_keywords: ['transcript', 'summary', 'send transcript'],
      send_on_chat_end: false,
      max_attachment_size: 10
    }
  });
};

export const updateTranscriptConfig = (chatbotId, config) => {
  return api.put(`/transcript/${chatbotId}`, config);
};

// Email Template API endpoints
export const getEmailTemplates = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/email-templates`);
};

export const createEmailTemplate = (chatbotId, templateData) => {
  return api.post(`/chatbot/${chatbotId}/email-templates`, templateData);
};

export const updateEmailTemplate = (chatbotId, templateId, templateData) => {
  return api.put(`/chatbot/${chatbotId}/email-templates/${templateId}`, templateData);
};

export const deleteEmailTemplate = (chatbotId, templateId) => {
  return api.delete(`/chatbot/${chatbotId}/email-templates/${templateId}`);
};

// Social Media API endpoints
export const getSocialMediaLinks = (chatbotId) => {
  // Return mock data since endpoint doesn't exist
  return Promise.resolve({
    data: []
  });
};

// Product Images API endpoints
export const getProductImagesUploadUrl = (chatbotId, filename, contentType) => {
  return api.post(`/chatbot/${chatbotId}/product-images/upload-url`, { filename, contentType });
};

/** Multipart upload to API disk (no S3). Field name: `file`. */
export const uploadProductImageFile = (chatbotId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/chatbot/${chatbotId}/product-images/upload`, formData);
};

export const updateProductImagesConfig = (chatbotId, config) => {
  return api.put(`/chatbot/${chatbotId}/product-images`, config);
};

export const createSocialMediaLink = (chatbotId, linkData) => {
  return api.post(`/chatbot/${chatbotId}/social-media-links`, linkData);
};

export const updateSocialMediaLink = (chatbotId, linkId, linkData) => {
  return api.put(`/chatbot/${chatbotId}/social-media-links/${linkId}`, linkData);
};

export const deleteSocialMediaLink = (chatbotId, linkId) => {
  return api.delete(`/chatbot/${chatbotId}/social-media-links/${linkId}`);
};

export const updateChatbotSidebarSocial = (chatbotId, enabled) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/social`, { enabled });
};

export const updateChatbotSidebarBranding = (chatbotId, brandingData) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/branding`, brandingData);
};

export const updateChatbotSidebarHeader = (chatbotId, headerData) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/header`, headerData);
};

// Knowledge base / context API endpoints
export const getKnowledgeBaseFiles = (chatbotId) => {
  return api.get(`/context/files/${chatbotId}`);
};

export const deleteKnowledgeBaseFile = (fileId, chatbotId) => {
  // chatbotId is required for backend to find the correct chatbot
  return api.delete(`/context/files/${fileId}`, {
    params: { chatbotId }
  });
};

// Custom Navigation API endpoints
export const getCustomNavigationItems = (chatbotId) => {
  return api.get(`/chatbot/${chatbotId}/custom-navigation-items`);
};

export const createCustomNavigationItem = (chatbotId, itemData) => {
  return api.post(`/chatbot/${chatbotId}/custom-navigation-items`, itemData);
};

export const updateCustomNavigationItem = (chatbotId, itemId, itemData) => {
  return api.put(`/chatbot/${chatbotId}/custom-navigation-items/${itemId}`, itemData);
};

export const deleteCustomNavigationItem = (chatbotId, itemId) => {
  return api.delete(`/chatbot/${chatbotId}/custom-navigation-items/${itemId}`);
};

export const updateChatbotSidebarCustomNav = (chatbotId, enabled) => {
  return api.put(`/chatbot/${chatbotId}/sidebar-config/custom-nav`, { enabled });
};

// Daily email template & logs
export const getDailyEmailTemplate = () => api.get("/admin/daily-email-template");
export const updateDailyEmailTemplate = (payload) => api.put("/admin/daily-email-template", payload);
export const sendDailyEmail = (payload) => api.post("/admin/send-daily-email", payload);
export const fetchDailyEmailLogs = (limit = 50) =>
  api.get(`/admin/daily-email-logs?limit=${limit}`);

export default api;
// Calling Tool API endpoints
export const getCallingToolConfig = (chatbotId) => {
  return api.get(`/calling/${chatbotId}`);
};

export const updateCallingToolConfig = (chatbotId, config) => {
  return api.put(`/calling/${chatbotId}`, config);
};
