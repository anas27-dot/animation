// services/emailService.js
const { Resend } = require("resend");
const logger = require('../config/logging');
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendWithResend(payload, logLabel = "Resend email") {
  try {
    if (!process.env.RESEND_API_KEY || !resend) {
      logger.error("❌ RESEND_API_KEY missing");
      return false;
    }
    if (!process.env.RESEND_FROM) {
      logger.error("❌ RESEND_FROM missing");
      return false;
    }

    const finalPayload = {
      from: process.env.RESEND_FROM,
      ...payload,
    };

    const resp = await resend.emails.send(finalPayload);

    if (resp?.error) {
      logger.error(`❌ ${logLabel} error:`, resp.error);
      return false;
    }
    const messageId = resp?.data?.id || resp?.id;
    if (messageId) {
      logger.info(`✅ ${logLabel} queued id:`, messageId);
      return true;
    }

    logger.error(`❌ Unknown ${logLabel} response:`, resp);
    return false;
  } catch (err) {
    logger.error(`❌ ${logLabel} exception:`, err?.response?.data || err?.message || err);
    return false;
  }
}

async function sendCustomEmail({ to, subject, html, text }) {
  return sendWithResend(
    {
      to,
      subject,
      html: html || (text ? `<pre>${text}</pre>` : "<p></p>"),
    },
    "Custom template email"
  );
}

module.exports = { sendCustomEmail };
