/**
 * Resolve AISensy configuration with fallback hierarchy:
 * 1. Template-specific config (highest priority)
 * 2. Chatbot default config
 * 3. Environment variables (lowest priority)
 * 
 * @param {object} template - Template object (optional)
 * @param {object} chatbot - Chatbot object
 * @returns {object} - { apiKey, orgSlug, senderName, countryCode }
 */
function resolveAISensyConfig(template, chatbot) {
  const apiKey = template?.api_key 
    || chatbot?.settings?.sidebar?.whatsapp_proposal?.default_api_key
    || process.env.AISENSY_API_KEY;
  
  const orgSlug = template?.org_slug 
    || chatbot?.settings?.sidebar?.whatsapp_proposal?.default_org_slug
    || process.env.AISENSY_ORG_SLUG 
    || 'troika-tech-services';
  
  const senderName = template?.sender_name 
    || chatbot?.settings?.sidebar?.whatsapp_proposal?.default_sender_name
    || process.env.AISENSY_SENDER_NAME 
    || 'Troika Tech Services';
  
  const countryCode = (template?.country_code 
    || chatbot?.settings?.sidebar?.whatsapp_proposal?.default_country_code
    || process.env.AISENSY_COUNTRY_CODE 
    || '91').replace('+', '');
  
  return { apiKey, orgSlug, senderName, countryCode };
}

module.exports = resolveAISensyConfig;
