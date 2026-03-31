const emailService = require('./emailService');
const logger = require('../config/logging');

/**
 * Service to handle automated usage alerts (Credits & Duration)
 */
const usageAlertService = {

    /**
     * Checks if low credit alerts should be sent and sends them
     * @param {Object} company - The company document
     */
    async checkCreditAlerts(company) {
        if (!company || !company.credits || !company.email) return;

        const remaining = company.credits.remaining;
        const notifications = company.credits.notifications || {};
        let updated = false;

        // 100 Credits
        if (remaining <= 100 && remaining > 50 && !notifications.lowCredit100) {
            await this.sendAlert(company, 'LOW_CREDIT', 100);
            company.credits.notifications.lowCredit100 = true;
            updated = true;
        }
        // 50 Credits
        else if (remaining <= 50 && remaining > 10 && !notifications.lowCredit50) {
            await this.sendAlert(company, 'LOW_CREDIT', 50);
            company.credits.notifications.lowCredit50 = true;
            updated = true;
        }
        // 10 Credits
        else if (remaining <= 10 && remaining > 0 && !notifications.lowCredit10) {
            await this.sendAlert(company, 'LOW_CREDIT', 10);
            company.credits.notifications.lowCredit10 = true;
            updated = true;
        }
        // Exhausted
        else if (remaining <= 0 && !notifications.exhausted) {
            await this.sendAlert(company, 'EXHAUSTED', 0);
            company.credits.notifications.exhausted = true;
            updated = true;
        }

        if (updated) {
            await company.save();
        }
    },

    /**
     * Checks if duration alerts should be sent and sends them
     * @param {Object} company - The company document
     */
    async checkDurationAlerts(company) {
        if (!company || !company.credits || !company.credits.expiresAt || !company.email) return;

        const now = new Date();
        const expiresAt = new Date(company.credits.expiresAt);
        const diffTime = expiresAt - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const notifications = company.credits.notifications || {};
        let updated = false;

        // 7 Days
        if (diffDays <= 7 && diffDays > 3 && !notifications.expiring7Days) {
            await this.sendAlert(company, 'EXPIRING_SOON', 7);
            company.credits.notifications.expiring7Days = true;
            updated = true;
        }
        // 3 Days
        else if (diffDays <= 3 && diffDays > 1 && !notifications.expiring3Days) {
            await this.sendAlert(company, 'EXPIRING_SOON', 3);
            company.credits.notifications.expiring3Days = true;
            updated = true;
        }
        // 1 Day
        else if (diffDays <= 1 && diffDays > 0 && !notifications.expiring1Day) {
            await this.sendAlert(company, 'EXPIRING_SOON', 1);
            company.credits.notifications.expiring1Day = true;
            updated = true;
        }
        // Expired
        else if (diffDays <= 0 && !notifications.expired) {
            await this.sendAlert(company, 'EXPIRED', 0);
            company.credits.notifications.expired = true;
            updated = true;
        }

        if (updated) {
            await company.save();
        }
    },

    /**
     * Generates and sends the alert email
     */
    async sendAlert(company, type, threshold) {
        const { email, name } = company;
        let subject = '';
        let html = '';

        const colors = {
            warning: '#FBBF24', // Amber 400
            danger: '#EF4444',  // Red 500
            info: '#3B82F6',    // Blue 500
            accent: '#8B5CF6'   // Violet 500
        };

        if (type === 'LOW_CREDIT') {
            subject = `⚡ Low Credits Alert: ${threshold} Remaining - ${name}`;
            html = this.getTemplate({
                title: 'Energy Low!',
                message: `Your AI Agent credits are running low. You have approximately <b>${threshold} credits</b> remaining.`,
                stat: `${threshold} Credits`,
                subtext: 'To avoid any interruption in service, please top up your credits.',
                themeColor: threshold <= 10 ? colors.danger : colors.warning
            });
        } else if (type === 'EXHAUSTED') {
            subject = `🛑 Credits Exhausted - ${name}`;
            html = this.getTemplate({
                title: 'Service Paused',
                message: `Your AI Agent has run out of credits. Auto-replies are currently disabled.`,
                stat: `0 Credits`,
                subtext: 'Reactivate your service immediately by adding more credits.',
                themeColor: colors.danger
            });
        } else if (type === 'EXPIRING_SOON') {
            subject = `⏳ Plan Expiring Soon: ${threshold} Days Left - ${name}`;
            html = this.getTemplate({
                title: 'Time is Running Out',
                message: `Your current plan with OmniAgent is set to expire soon.`,
                stat: `${threshold} Days Left`,
                subtext: `Your service will expire on <b>${new Date(company.credits.expiresAt).toLocaleDateString()}</b>.`,
                themeColor: threshold <= 1 ? colors.danger : colors.info
            });
        } else if (type === 'EXPIRED') {
            subject = `🛑 Plan Expired - ${name}`;
            html = this.getTemplate({
                title: 'Subscription Ended',
                message: `Your plan has expired and your Ai Agent services have been paused.`,
                stat: `Expired`,
                subtext: 'Renew your subscription to restore all features.',
                themeColor: colors.danger
            });
        }

        try {
            logger.info(`📧 Sending ${type} alert to ${email} (Threshold: ${threshold})`);
            await emailService.sendCustomEmail({
                to: email,
                subject: subject,
                html: html
            });
        } catch (err) {
            logger.error(`❌ Failed to send ${type} alert to ${email}:`, err);
        }
    },

    /**
     * Premium HTML Template generator
     */
    getTemplate({ title, message, stat, themeColor }) {
        return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            .container { font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f9fafb; }
            .card { background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; position: relative; overflow: hidden; }
            .accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 8px; background-color: ${themeColor}; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { color: #111827; font-size: 28px; font-weight: 800; margin-bottom: 10px; }
            .message { color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px; }
            .stat-box { background: #f3f4f6; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 30px; border: 1px dashed ${themeColor}; }
            .stat-value { color: ${themeColor}; font-size: 32px; font-weight: 800; }
            .contact-section { background: #fdf2f2; border-radius: 16px; padding: 20px; text-align: center; border: 1px solid #fecaca; }
            .contact-title { color: #b91c1c; font-weight: 700; font-size: 16px; margin-bottom: 8px; }
            .contact-text { color: #7f1d1d; font-size: 14px; line-height: 1.5; }
            .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="accent-bar"></div>
                <div class="header">
                    <div class="title">${title}</div>
                </div>
                <div class="message">${message}</div>
                <div class="stat-box">
                    <div class="stat-value">${stat}</div>
                </div>
                <div class="contact-section">
                    <div class="contact-title">Need to Recharge or Renew?</div>
                    <div class="contact-text">
                        Please contact the <b>Troika Tech team</b> to add credits or renew your subscription properly to avoid service interruption.
                    </div>
                </div>
            </div>
            <div class="footer">
                &copy; 2026 OmniAgent. All rights reserved.<br>
                Powered by Troika Tech Solutions
            </div>
        </div>
    </body>
    </html>
    `;
    }
};

module.exports = usageAlertService;
