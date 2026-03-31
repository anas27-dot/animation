const leadCaptureService = require('../services/leadCaptureService');
const logger = require('../config/logging');

async function captureLead(req, res) {
  try {
    const { chatbotId, sessionId, name, email, phone, company, message } = req.body;

    if (!chatbotId || !sessionId || !name || !email) {
      return res.status(400).json({
        error: 'Missing required fields: chatbotId, sessionId, name, email',
      });
    }

    const lead = await leadCaptureService.captureLead({
      chatbotId,
      sessionId,
      name,
      email,
      phone,
      company,
      message,
      metadata: {
        source: req.body.platform || 'web',
        referrer: req.get('referer'),
        userAgent: req.get('user-agent'),
      },
    });

    res.status(201).json(lead);
  } catch (error) {
    logger.error('Capture lead error:', error);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
}

async function getLeads(req, res) {
  try {
    const { chatbotId } = req.params;
    const { startDate, endDate, limit, skip } = req.query;

    const leads = await leadCaptureService.getLeadsByChatbot(chatbotId, {
      startDate,
      endDate,
      limit: parseInt(limit) || 100,
      skip: parseInt(skip) || 0,
    });

    res.json({ leads });
  } catch (error) {
    logger.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
}

async function exportToCRM(req, res) {
  try {
    const { leadId } = req.params;
    const { crmData } = req.body;

    const lead = await leadCaptureService.syncToCRM(leadId, crmData);

    res.json({ success: true, lead });
  } catch (error) {
    logger.error('Export to CRM error:', error);
    res.status(500).json({ error: 'Failed to export to CRM' });
  }
}

module.exports = {
  captureLead,
  getLeads,
  exportToCRM,
};

