const cron = require('node-cron');
const mongoose = require('mongoose');
const DailySummary = require('../models/DailySummary');
const Chatbot = require('../models/Chatbot');
const Message = require('../models/Message');
const Company = require('../models/Company');
const logger = require('../config/logging');
const usageAlertService = require('./usageAlertService');

// Import summary generation functions from userController
const userController = require('../controllers/userController');
const extractTopicsFromMessages = userController.extractTopicsFromMessages;
const generateDailySummary = userController.generateDailySummary;

/**
 * Generate daily summary for a specific chatbot and date
 * @param {mongoose.Types.ObjectId} chatbotId - Chatbot ID
 * @param {mongoose.Types.ObjectId} companyId - Company ID
 * @param {String} chatbotName - Chatbot name
 * @param {Date} targetDate - Date to generate summary for (previous day)
 */
async function generateChatbotDailySummary(chatbotId, companyId, chatbotName, targetDate) {
  try {
    logger.info(`📊 [DailySummary] Generating summary for chatbot ${chatbotName} (${chatbotId}) for date ${targetDate.toISOString().split('T')[0]}`);

    // Calculate date range for target date in UTC (MongoDB stores dates in UTC)
    // Get the date string in YYYY-MM-DD format
    const dateStr = targetDate.toISOString().split('T')[0]; // e.g., "2026-01-11"

    // Create UTC date range for the entire day
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z'); // UTC midnight
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z'); // UTC end of day

    // Get all messages for this specific chatbot from target date
    const messages = await Message.find({
      chatbotId: chatbotId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: 1 });

    logger.info(`📊 [DailySummary] Found ${messages.length} messages for chatbot ${chatbotName} on ${targetDate.toISOString().split('T')[0]}`);
    logger.info(`📊 [DailySummary] Date range (UTC): ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    // Debug: Check if there are any messages for this chatbot at all
    const totalMessagesForChatbot = await Message.countDocuments({ chatbotId: chatbotId });
    logger.info(`📊 [DailySummary] Total messages for this chatbot (all time): ${totalMessagesForChatbot}`);

    if (totalMessagesForChatbot > 0 && messages.length === 0) {
      // Check what dates messages exist for
      const sampleMessage = await Message.findOne({ chatbotId: chatbotId }).sort({ createdAt: -1 });
      if (sampleMessage) {
        logger.info(`📊 [DailySummary] Most recent message date: ${sampleMessage.createdAt.toISOString()}`);
      }
    }

    if (messages.length === 0) {
      logger.info(`📊 [DailySummary] No messages found for chatbot ${chatbotName} on ${targetDate.toISOString().split('T')[0]}, creating empty summary`);

      // Create empty summary record
      await DailySummary.findOneAndUpdate(
        { chatbotId: chatbotId, date: startOfDay },
        {
          company: companyId,
          chatbotId: chatbotId,
          chatbotName: chatbotName,
          date: startOfDay,
          summary: "No conversations were recorded on this day. The chatbot is ready to engage with users and provide assistance.",
          messageCount: 0,
          sessionCount: 0,
          topTopics: [],
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      return;
    }

    // Get unique sessions
    const sessions = [...new Set(messages.map(msg => msg.sessionId))];

    // Extract topics
    const topTopics = extractTopicsFromMessages(messages);

    // Generate summary
    const summary = generateDailySummary(messages, sessions.length, topTopics);

    // Save or update summary
    await DailySummary.findOneAndUpdate(
      { chatbotId: chatbotId, date: startOfDay },
      {
        company: companyId,
        chatbotId: chatbotId,
        chatbotName: chatbotName,
        date: startOfDay,
        summary: summary,
        messageCount: messages.length,
        sessionCount: sessions.length,
        topTopics: topTopics,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    logger.info(`✅ [DailySummary] Successfully generated summary for chatbot ${chatbotName} - ${messages.length} messages, ${sessions.length} sessions`);
  } catch (error) {
    logger.error(`❌ [DailySummary] Error generating summary for chatbot ${chatbotId}:`, error);
  }
}

/**
 * Generate daily summaries for all companies
 * This function processes the previous day's chats (or today's if in test mode)
 */
async function generateAllDailySummaries(useToday = false) {
  try {
    logger.info('🌙 [DailySummary] Starting nightly summary generation...');

    // Get target date (yesterday by default, today if testing)
    // Use UTC to avoid timezone issues with MongoDB
    const now = new Date();
    const targetDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      useToday ? now.getUTCDate() : now.getUTCDate() - 1, // Previous day if not testing
      0, 0, 0, 0 // UTC midnight
    ));

    const dateLabel = useToday ? 'today' : 'yesterday';
    logger.info(`📅 [DailySummary] Target date: ${targetDate.toISOString().split('T')[0]} (${dateLabel})`);

    // Get all active companies
    const companies = await Company.find({ isActive: true });

    logger.info(`📊 [DailySummary] Processing ${companies.length} companies for date ${targetDate.toISOString().split('T')[0]}`);

    // Generate summaries for each chatbot in each company
    // Process companies sequentially, but chatbots in parallel
    for (const company of companies) {
      const chatbots = await Chatbot.find({ company: company._id });
      logger.info(`📊 [DailySummary] Processing ${chatbots.length} chatbot(s) for company ${company.name}`);

      // Process chatbots in batches
      const batchSize = 5;
      for (let i = 0; i < chatbots.length; i += batchSize) {
        const batch = chatbots.slice(i, i + batchSize);
        await Promise.all(batch.map(chatbot =>
          generateChatbotDailySummary(chatbot._id, company._id, chatbot.name, targetDate)
        ));
      }

      // ⏳ Check Plan Duration Alerts (7/3/1 days)
      usageAlertService.checkDurationAlerts(company).catch(err => logger.error('Duration Alert Error:', err));
    }

    logger.info('✅ [DailySummary] Nightly summary generation completed');
  } catch (error) {
    logger.error('❌ [DailySummary] Error in nightly summary generation:', error);
  }
}

/**
 * Initialize the scheduled job
 * Runs daily at 3:02 PM (configurable via environment variable)
 * Note: Changed to 3:02 PM for testing. Change back to '0 2 * * *' for 2:00 AM production
 * TEMPORARILY using today's messages for testing - change back to false for production
 */
function initializeDailySummaryScheduler() {
  // Default to 3:02 PM for testing, can be configured via environment variable
  // Format: "2 15 * * *" (cron format: minute hour day month weekday)
  // For production: use '0 2 * * *' for 2:00 AM
  const scheduleTime = process.env.DAILY_SUMMARY_SCHEDULE || '2 15 * * *';

  logger.info(`⏰ [DailySummary] Scheduling daily summary generation at: ${scheduleTime} (3:02 PM)`);

  // Schedule the job to run daily at the specified time
  // TEMPORARILY using today's messages for testing - change back to false for production
  const useTodayForTesting = process.env.DAILY_SUMMARY_USE_TODAY === 'true' || process.env.NODE_ENV === 'development'; // Use today in development for testing

  cron.schedule(scheduleTime, async () => {
    logger.info(`🌙 [DailySummary] Scheduled job triggered - generating daily summaries for ${useTodayForTesting ? 'TODAY (testing)' : 'PREVIOUS DAY'}...`);
    await generateAllDailySummaries(useTodayForTesting); // Use today for testing, yesterday for production
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  logger.info('✅ [DailySummary] Daily summary scheduler initialized');
}

/**
 * Manual trigger for testing - generates summaries for today
 */
async function generateTodaySummaries() {
  logger.info('🧪 [DailySummary] Manual trigger - generating summaries for TODAY (testing mode)');
  await generateAllDailySummaries(true); // Pass true to use today instead of yesterday
}

module.exports = {
  initializeDailySummaryScheduler,
  generateAllDailySummaries,
  generateChatbotDailySummary,
  generateTodaySummaries
};
