/**
 * Email Template Controller
 * Handles email template CRUD operations and email sending
 */

const EmailTemplate = require("../models/EmailTemplate");
const Chatbot = require("../models/Chatbot");
const logger = require('../config/logging');
const { sendCustomEmail } = require('../services/emailService');

const KNOWN_TLDS = new Set(
  'com org net edu gov mil int info biz name pro museum aero coop tel travel jobs post asia cat mobi io co ai app dev tech online site store shop blog cloud email company solutions services digital today world life news media social agency studio design photo gallery systems software network global international group partners ventures space xyz icu top win vip work website restaurant realty law medical engineer'.split(/\s+/)
);

function isValidEmail(email) {
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
}

/**
 * GET /chatbot/:id/email-templates
 * Get all email templates for a chatbot (public)
 */
exports.getEmailTemplates = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify chatbot exists
    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: "Chatbot not found" });
    }

    const templates = await EmailTemplate.find({ 
      chatbot_id: id,
      is_active: true 
    })
      .sort({ order: 1, createdAt: -1 })
      .select('-__v')
      .lean();

    return res.json({
      success: true,
      data: {
        templates: templates || [],
      },
    });
  } catch (error) {
    logger.error('Get email templates error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch email templates' });
  }
};

/**
 * POST /chatbot/:id/email-templates
 * Create a new email template (admin only)
 */
exports.createEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { template_name, email_subject, email_body, is_active, order } = req.body;

    // Verify chatbot exists
    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: "Chatbot not found" });
    }

    // Validation
    if (!template_name || typeof template_name !== "string" || !template_name.trim()) {
      return res.status(400).json({ error: "template_name is required and must be a non-empty string" });
    }

    if (!email_subject || typeof email_subject !== "string" || !email_subject.trim()) {
      return res.status(400).json({ error: "email_subject is required and must be a non-empty string" });
    }

    if (!email_body || typeof email_body !== "string" || !email_body.trim()) {
      return res.status(400).json({ error: "email_body is required and must be a non-empty string" });
    }

    if (template_name.length > 100) {
      return res.status(400).json({ error: "template_name must be 100 characters or less" });
    }

    if (email_subject.length > 200) {
      return res.status(400).json({ error: "email_subject must be 200 characters or less" });
    }

    // Get the highest order number to set default
    const maxOrder = await EmailTemplate.findOne({ chatbot_id: id })
      .sort({ order: -1 })
      .select("order");
    const nextOrder = maxOrder ? (maxOrder.order + 1) : 0;

    const template = await EmailTemplate.create({
      chatbot_id: id,
      template_name: template_name.trim(),
      email_subject: email_subject.trim(),
      email_body: email_body.trim(),
      is_active: is_active !== undefined ? is_active : true,
      order: order !== undefined ? order : nextOrder,
    });

    logger.info(`Email template created for chatbot ${id}: ${template._id}`);
    return res.json({
      success: true,
      data: {
        template: template,
      },
    });
  } catch (error) {
    logger.error('Create email template error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create email template' });
  }
};

/**
 * PUT /chatbot/:id/email-templates/:templateId
 * Update an email template (admin only)
 */
exports.updateEmailTemplate = async (req, res) => {
  try {
    const { id, templateId } = req.params;
    const { template_name, email_subject, email_body, is_active, order } = req.body;

    // Verify chatbot exists
    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: "Chatbot not found" });
    }

    // Verify template exists and belongs to this chatbot
    const template = await EmailTemplate.findOne({ _id: templateId, chatbot_id: id });
    if (!template) {
      return res.status(404).json({ error: "Email template not found" });
    }

    const updateData = {};

    if (template_name !== undefined) {
      if (typeof template_name !== "string" || !template_name.trim()) {
        return res.status(400).json({ error: "template_name must be a non-empty string" });
      }
      if (template_name.length > 100) {
        return res.status(400).json({ error: "template_name must be 100 characters or less" });
      }
      updateData.template_name = template_name.trim();
    }

    if (email_subject !== undefined) {
      if (typeof email_subject !== "string" || !email_subject.trim()) {
        return res.status(400).json({ error: "email_subject must be a non-empty string" });
      }
      if (email_subject.length > 200) {
        return res.status(400).json({ error: "email_subject must be 200 characters or less" });
      }
      updateData.email_subject = email_subject.trim();
    }

    if (email_body !== undefined) {
      if (typeof email_body !== "string" || !email_body.trim()) {
        return res.status(400).json({ error: "email_body must be a non-empty string" });
      }
      updateData.email_body = email_body.trim();
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return res.status(400).json({ error: "is_active must be a boolean" });
      }
      updateData.is_active = is_active;
    }

    if (order !== undefined) {
      if (typeof order !== "number") {
        return res.status(400).json({ error: "order must be a number" });
      }
      updateData.order = order;
    }

    const updatedTemplate = await EmailTemplate.findByIdAndUpdate(
      templateId,
      updateData,
      { new: true }
    ).select("-__v");

    logger.info(`Email template updated for chatbot ${id}: ${templateId}`);
    return res.json({
      success: true,
      data: {
        template: updatedTemplate,
      },
    });
  } catch (error) {
    logger.error('Update email template error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update email template' });
  }
};

/**
 * DELETE /chatbot/:id/email-templates/:templateId
 * Delete an email template (admin only)
 */
exports.deleteEmailTemplate = async (req, res) => {
  try {
    const { id, templateId } = req.params;

    // Verify chatbot exists
    const chatbot = await Chatbot.findById(id);
    if (!chatbot) {
      return res.status(404).json({ error: "Chatbot not found" });
    }

    // Verify template exists and belongs to this chatbot
    const template = await EmailTemplate.findOne({ _id: templateId, chatbot_id: id });
    if (!template) {
      return res.status(404).json({ error: "Email template not found" });
    }

    await EmailTemplate.findByIdAndDelete(templateId);

    logger.info(`Email template deleted for chatbot ${id}: ${templateId}`);
    return res.json({
      success: true,
      data: {
        template_id: templateId,
      },
    });
  } catch (error) {
    logger.error('Delete email template error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete email template' });
  }
};

/**
 * POST /chatbot/:id/send-email
 * Send email with selected template (public)
 */
exports.sendEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { template_id, recipient_email, recipient_phone, variables } = req.body;

    // Verify chatbot exists and get company_id
    const chatbot = await Chatbot.findById(id).select("company_id name company_name");
    if (!chatbot) {
      return res.status(404).json({ error: "Chatbot not found" });
    }
    
    // Log for debugging
    logger.info(`[sendEmail] Sending email for chatbot ${id}, company_id: ${chatbot.company_id}, recipient: ${recipient_email}`);

    // Validation
    if (!template_id) {
      return res.status(400).json({ error: "template_id is required" });
    }

    if (!recipient_email || typeof recipient_email !== "string") {
      return res.status(400).json({ error: "recipient_email is required and must be a valid email" });
    }

    if (!isValidEmail(recipient_email.trim())) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Get template
    const template = await EmailTemplate.findOne({ _id: template_id, chatbot_id: id, is_active: true });
    if (!template) {
      return res.status(404).json({ error: "Email template not found or is inactive" });
    }

    // Process email body with variables
    let processedBody = template.email_body;
    let processedSubject = template.email_subject;

    if (variables && typeof variables === "object") {
      // Replace variables in format {variable_name}
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        processedBody = processedBody.replace(regex, variables[key] || '');
        processedSubject = processedSubject.replace(regex, variables[key] || '');
      });
    }

    // Replace common variables if not provided
    if (!variables || !variables.name) {
      processedBody = processedBody.replace(/{name}/g, recipient_email.split('@')[0]);
      processedSubject = processedSubject.replace(/{name}/g, recipient_email.split('@')[0]);
    }

    // Send email
    let emailSent = false;
    let errorMessage = null;

    try {
      logger.info(`📧 [sendEmail] Attempting to send email:`, {
        to: recipient_email.trim(),
        subject: processedSubject || template.email_subject,
        bodyLength: processedBody?.length || 0,
        hasResendKey: !!process.env.RESEND_API_KEY,
        resendFrom: process.env.RESEND_FROM || 'NOT SET',
      });

      emailSent = await sendCustomEmail({
        to: recipient_email.trim(),
        subject: processedSubject || template.email_subject || "Email from Chat Agent",
        html: processedBody || template.email_body,
      });

      if (emailSent) {
        logger.info(`✅ [sendEmail] Email queued successfully to ${recipient_email}`);
      } else {
        logger.warn(`⚠️ [sendEmail] Email service returned false - check Resend configuration`);
      }
    } catch (error) {
      logger.error(`❌ [sendEmail] Error sending email:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      });
      errorMessage = error.message || "Failed to send email";
    }

    if (!emailSent) {
      return res.status(500).json({ 
        error: errorMessage || "Failed to send email. Please check your email service configuration." 
      });
    }

    logger.info(`✅ Email sent successfully to ${recipient_email} using template ${template_id}`);
    return res.json({
      success: true,
      data: {
        sent: true,
        recipient: recipient_email,
        template_id: template_id,
      },
      message: "Email sent successfully",
    });
  } catch (error) {
    logger.error('Send email error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
};
