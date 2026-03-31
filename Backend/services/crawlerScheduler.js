require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('../config/logging');
const Company = require('../models/Company');
const Chatbot = require('../models/Chatbot');

/**
 * Get all companies that have crawler enabled
 */
async function getCrawlerCompanies() {
  let mongooseConnection = null;
  try {
    // Check if mongoose is already connected
    if (mongoose.connection.readyState !== 1) {
      logger.info('🔄 [Crawler] Establishing new database connection...');
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-agent';
      mongooseConnection = require('mongoose');
      await mongooseConnection.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      logger.info('✅ [Crawler] Database connection established');
    }

    // Query companies with crawler enabled
    const companies = await Company.find({ 'settings.crawler.enabled': true });
    logger.info(`📊 [Crawler] Found ${companies.length} companies with crawler enabled`);
    return companies;

  } catch (error) {
    logger.error('❌ [Crawler] Error finding crawler companies:', error.message);
    return [];
  } finally {
    // Close connection if we created it
    if (mongooseConnection && mongooseConnection.connection.readyState === 1) {
      try {
        await mongooseConnection.disconnect();
        logger.info('🔌 [Crawler] Database connection closed');
      } catch (err) {
        logger.warn('⚠️ [Crawler] Error closing database connection:', err.message);
      }
    }
  }
}

/**
 * Crawl a specific company
 */
async function crawlCompany(company) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../crawler_api.py');

    // Ensure the domain has a proper URL scheme
    let targetUrl = company.domain;
    if (!targetUrl) {
      reject(new Error(`No domain configured for company ${company.name}`));
      return;
    }

    // Add https:// if the domain doesn't have a scheme
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // Verify script exists
    if (!require('fs').existsSync(pythonScript)) {
      reject(new Error(`Python crawler script not found at: ${pythonScript}`));
      return;
    }

    logger.info(`🐍 [Crawler] Executing: python "${pythonScript}" "${targetUrl}" "${company.chatbotId}" "${company.apiKey}"`);

    // Spawn Python process with target URL, chatbot ID, and API key
    const pythonProcess = spawn('python', [pythonScript, targetUrl, company.chatbotId.toString(), company.apiKey], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(pythonScript)
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      logger.info(`🐍 [Crawler] ${data.toString().trim()}`);
    });

    // Collect stderr
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      logger.warn(`🐍 [Crawler] ERROR: ${data.toString().trim()}`);
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      logger.info(`🐍 [Crawler] Python process for ${company.name} exited with code ${code}`);

      if (code === 0) {
        logger.info(`✅ [Crawler] Python crawling completed successfully for ${company.name}`);
        resolve({
          success: true,
          code: code,
          output: stdout,
          pagesProcessed: extractPageCount(stdout)
        });
      } else {
        logger.error(`❌ [Crawler] Python crawling failed for ${company.name} with code ${code}`);
        logger.error(`❌ [Crawler] Error output: ${stderr}`);
        reject(new Error(`Python crawler failed for ${company.name} with code ${code}: ${stderr}`));
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      logger.error(`❌ [Crawler] Process error for ${company.name}:`, error);
      reject(error);
    });
  });
}

/**
 * Extract page count from crawler output
 */
function extractPageCount(output) {
  const match = output.match(/Completed:\s*(\d+)\s*pages/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Main crawler trigger function
 */
async function triggerCrawler() {
  try {
    const companies = await getCrawlerCompanies();

    if (!companies || companies.length === 0) {
      logger.warn('⚠️ [Crawler] No companies found with crawler enabled');
      return { success: false, error: 'No companies with crawler enabled' };
    }

    logger.info(`🌐 [Crawler] Starting crawl for ${companies.length} companies`);

    const results = [];
    let totalPagesProcessed = 0;

    for (const company of companies) {
      try {
        logger.info(`🏢 [Crawler] Processing company: ${company.name} (${company._id})`);

        // Find the primary chatbot for this company
        const chatbot = await Chatbot.findOne({ company: company._id });
        if (!chatbot) {
          logger.warn(`⚠️ [Crawler] No chatbot found for company ${company.name}, skipping`);
          results.push({
            companyId: company._id,
            companyName: company.name,
            success: false,
            error: 'No chatbot found for company'
          });
          continue;
        }

        logger.info(`🤖 [Crawler] Found chatbot for ${company.name}: ${chatbot.name} (${chatbot._id})`);
        logger.info(`🌐 [Crawler] Target URL: ${company.domain}`);

        // Pass the ACTUAL chatbotId instead of companyId
        const result = await crawlCompany({
          ...company.toObject(),
          chatbotId: chatbot._id
        });

        results.push({
          companyId: company._id,
          chatbotId: chatbot._id,
          companyName: company.name,
          success: result.success,
          pagesProcessed: result.pagesProcessed
        });
        totalPagesProcessed += result.pagesProcessed || 0;

      } catch (error) {
        logger.error(`❌ [Crawler] Failed to crawl company ${company.name}:`, error);
        results.push({
          companyId: company._id,
          companyName: company.name,
          success: false,
          error: error.message
        });
      }
    }

    const successfulCrawls = results.filter(r => r.success).length;
    logger.info(`📊 [Crawler] Completed: ${successfulCrawls}/${companies.length} companies crawled successfully`);
    logger.info(`📄 [Crawler] Total pages processed: ${totalPagesProcessed}`);

    return {
      success: true,
      companiesProcessed: companies.length,
      successfulCrawls: successfulCrawls,
      totalPagesProcessed: totalPagesProcessed,
      results: results
    };

  } catch (error) {
    logger.error('❌ [Crawler] Error in triggerCrawler:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the crawler scheduler
 */
async function initializeCrawlerScheduler() {
  try {
    // Get all companies with crawler enabled to determine schedule
    const enabledCompanies = await getCrawlerCompanies();

    if (!enabledCompanies || enabledCompanies.length === 0) {
      logger.warn('⚠️ [Crawler] No companies found with crawler enabled - scheduler not started');
      return;
    }

    // Use the schedule from the first enabled company, or default to 3:40 PM
    const scheduleTime = enabledCompanies[0].settings?.crawler?.schedule || '0 0 * * *';

    logger.info(`🏢 [Crawler] Initializing scheduler for ${enabledCompanies.length} companies`);
    logger.info(`⏰ [Crawler] Schedule: ${scheduleTime} (cron format)`);
    logger.info(`📊 [Crawler] Enabled companies: ${enabledCompanies.map(c => c.name).join(', ')}`);

    // Schedule the job to run and process ALL enabled companies
    cron.schedule(scheduleTime, async () => {
      logger.info(`🌐 [Crawler] Scheduled job triggered - starting web crawl for all enabled companies...`);
      try {
        const result = await triggerCrawler();
        if (result && result.success) {
          logger.info(`✅ [Crawler] Successfully crawled ${result.companiesProcessed} companies, ${result.totalPagesProcessed} total pages`);
        } else {
          logger.warn(`⚠️ [Crawler] Crawl completed with issues:`, result?.error || 'Unknown error');
        }
      } catch (error) {
        logger.error(`❌ [Crawler] Scheduled crawl failed:`, error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    logger.info(`✅ [Crawler] Web crawler scheduler initialized for ${enabledCompanies.length} companies`);

  } catch (error) {
    logger.error('❌ [Crawler] Error initializing crawler scheduler:', error);
  }
}

/**
 * Manual trigger for testing
 */
async function triggerCrawlerManually() {
  logger.info('🧪 [Crawler] Manual trigger - starting web crawler immediately...');
  return await triggerCrawler();
}

module.exports = {
  initializeCrawlerScheduler,
  triggerCrawler,
  triggerCrawlerManually,
  getCrawlerCompanies,
  crawlCompany
};