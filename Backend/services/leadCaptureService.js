const LeadCapture = require('../models/LeadCapture');
const logger = require('../config/logging');

async function captureLead(data) {
  try {
    const lead = new LeadCapture({
      chatbotId: data.chatbotId,
      sessionId: data.sessionId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      message: data.message,
      metadata: data.metadata || {},
    });

    await lead.save();
    logger.info(`Lead captured: ${lead.email} for chatbot ${data.chatbotId}`);

    return lead;
  } catch (error) {
    logger.error('Lead capture error:', error);
    throw error;
  }
}

async function getLeadsByChatbot(chatbotId, options = {}) {
  try {
    const query = { chatbotId };
    
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate);
      }
    }

    const leads = await LeadCapture.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 100)
      .skip(options.skip || 0);

    return leads;
  } catch (error) {
    logger.error('Get leads error:', error);
    throw error;
  }
}

async function syncToCRM(leadId, crmData) {
  try {
    // Placeholder for CRM integration (Zoho, etc.)
    // In production, implement actual CRM API calls
    
    const lead = await LeadCapture.findById(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Mark as synced
    lead.crmSynced = true;
    lead.crmId = crmData.crmId || 'pending';
    await lead.save();

    logger.info(`Lead ${leadId} synced to CRM`);
    return lead;
  } catch (error) {
    logger.error('CRM sync error:', error);
    throw error;
  }
}

module.exports = {
  captureLead,
  getLeadsByChatbot,
  syncToCRM,
};

