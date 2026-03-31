const express = require('express');
const router = express.Router();
const Chatbot = require('../models/Chatbot');
const { authenticateJWT } = require('../middleware/jwtAuthMiddleware');
const logger = require('../config/logging');
const { initiateCall } = require('../services/callingService');
const usageAlertService = require('../services/usageAlertService');

/**
 * GET /api/calling/:chatbotId
 * Get calling tool configuration for a chatbot
 */
router.get('/:chatbotId', async (req, res) => {
    try {
        const chatbot = await Chatbot.findById(req.params.chatbotId);

        if (!chatbot) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        const config = chatbot.settings?.calling_tool || {};

        res.json({
            data: {
                enabled: config.enabled || false,
                condition: config.condition || 'User wants to talk to a human, has a complex query, or specifically asks for a call',
                api_key: config.api_key || '',
                agent_id: config.agent_id || '',
                flow_question: config.flow_question || 'Would you like me to connect you via a call?',
                positive_responses: config.positive_responses || ['yes', 'sure', 'ok', 'call me', 'connect me', 'please', 'go ahead'],
                negative_responses: config.negative_responses || ['no', 'not now', 'later', 'maybe later', 'not yet', 'stop'],
                timeout_minutes: config.timeout_minutes || 10,
            },
        });
    } catch (error) {
        logger.error('Calling tool config error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/calling/:chatbotId
 * Update calling tool configuration (admin only)
 */
router.put('/:chatbotId', authenticateJWT, async (req, res) => {
    try {
        if (req.user.type !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const chatbot = await Chatbot.findById(req.params.chatbotId);
        if (!chatbot) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        const {
            enabled,
            condition,
            api_key,
            agent_id,
            flow_question,
            positive_responses,
            negative_responses,
            timeout_minutes,
        } = req.body;

        // Initialize calling_tool if it doesn't exist
        if (!chatbot.settings.calling_tool) {
            chatbot.settings.calling_tool = {};
        }

        // Update calling tool settings
        if (enabled !== undefined) chatbot.settings.calling_tool.enabled = enabled;
        if (condition !== undefined) chatbot.settings.calling_tool.condition = condition;
        if (api_key !== undefined) chatbot.settings.calling_tool.api_key = api_key;
        if (agent_id !== undefined) chatbot.settings.calling_tool.agent_id = agent_id;
        if (flow_question !== undefined) chatbot.settings.calling_tool.flow_question = flow_question;
        if (positive_responses !== undefined) {
            chatbot.settings.calling_tool.positive_responses = Array.isArray(positive_responses) ? positive_responses : [];
        }
        if (negative_responses !== undefined) {
            chatbot.settings.calling_tool.negative_responses = Array.isArray(negative_responses) ? negative_responses : [];
        }
        if (timeout_minutes !== undefined) chatbot.settings.calling_tool.timeout_minutes = timeout_minutes;

        // Mark settings as modified for Mongoose to detect nested changes
        chatbot.markModified('settings');
        chatbot.markModified('settings.calling_tool');

        await chatbot.save();

        logger.info(`✅ Calling tool config updated for chatbot ${req.params.chatbotId}`);

        // Return updated config
        const config = chatbot.settings.calling_tool || {};
        res.json({
            success: true,
            message: 'Calling tool configuration updated successfully',
            data: {
                enabled: config.enabled || false,
                condition: config.condition || 'User wants to talk to a human, has a complex query, or specifically asks for a call',
                api_key: config.api_key || '',
                agent_id: config.agent_id || '',
                flow_question: config.flow_question || 'Would you like me to connect you via a call?',
                positive_responses: config.positive_responses || [],
                negative_responses: config.negative_responses || [],
                timeout_minutes: config.timeout_minutes || 10,
            },
        });
    } catch (error) {
        logger.error('Update calling tool config error:', error);
        res.status(500).json({ error: error.message });
    }
});

const Company = require('../models/Company');

/**
 * POST /api/calling/initiate
 * Initiate a call (public/chatbot-side)
 */
router.post('/initiate', async (req, res) => {
    const { chatbotId, phoneNumber } = req.body;

    if (!chatbotId || !phoneNumber) {
        return res.status(400).json({
            error: 'chatbotId and phoneNumber are required',
        });
    }

    try {
        // Fetch chatbot to get company and config
        const chatbot = await Chatbot.findById(chatbotId).populate('company');
        if (!chatbot) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        const company = chatbot.company;
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Check if credits are configured for this company
        const hasCreditsConfigured = company && company.credits && company.credits.total !== undefined;
        const CALL_COST_CREDITS = 5; // Placeholder cost for a call

        if (hasCreditsConfigured) {
            // Check credits expiration
            if (company.credits.expiresAt && new Date() > new Date(company.credits.expiresAt)) {
                logger.warn(`💰 [Calling] Credits expired for company: ${company._id}`);
                return res.status(403).json({
                    error: 'CREDITS_EXHAUSTED',
                    message: 'Your subscription period has expired. Please contact support.',
                });
            }

            // Check remaining credits
            if (company.credits.remaining < CALL_COST_CREDITS) {
                logger.warn(`💰 [Calling] Insufficient credits for company: ${company._id}, remaining: ${company.credits.remaining}`);
                return res.status(403).json({
                    error: 'CREDITS_EXHAUSTED',
                    message: 'Insufficient credits to initiate a call. Please contact support.',
                });
            }
        }

        // Initiate the call
        const result = await initiateCall(phoneNumber, chatbotId);

        if (!result.success) {
            return res.status(400).json({
                error: result.error || 'Failed to initiate call',
            });
        }

        // Deduct credits if configured
        if (hasCreditsConfigured) {
            logger.info(`💰 [Calling] Deducting ${CALL_COST_CREDITS} credits for call from company: ${company._id}`);

            // Re-fetch company to avoid race conditions and ensure latest state
            const updatedCompany = await Company.findById(company._id);
            if (updatedCompany && updatedCompany.credits) {
                updatedCompany.credits.used += CALL_COST_CREDITS;
                updatedCompany.credits.remaining -= CALL_COST_CREDITS;

                // Add to history
                if (!updatedCompany.credits.history) updatedCompany.credits.history = [];
                updatedCompany.credits.history.push({
                    type: 'use',
                    amount: CALL_COST_CREDITS,
                    reason: `Outbound call to ${phoneNumber} via chatbot ${chatbot.name}`,
                    timestamp: new Date(),
                });

                updatedCompany.markModified('credits');
                await updatedCompany.save();
                logger.info(`✅ [Calling] Credits deducted. Remaining: ${updatedCompany.credits.remaining}`);

                // 🔥 Real-time Usage Alert Check (Non-blocking)
                usageAlertService.checkCreditAlerts(updatedCompany).catch(err => logger.error('Alert Error:', err));
            }
        }

        res.json({
            success: true,
            message: 'Call initiated successfully',
            data: result.data,
        });
    } catch (error) {
        logger.error('API initiate call error:', error);
        res.status(500).json({ error: 'Failed to initiate call' });
    }
});

module.exports = router;
