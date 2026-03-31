const admin = require('firebase-admin');
const path = require('path');
const logger = require('../config/logging');
const User = require('../models/User');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return;
  }

  try {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    
    // Check if service account file exists
    const fs = require('fs');
    if (!fs.existsSync(serviceAccountPath)) {
      logger.error(`Firebase service account file not found at: ${serviceAccountPath}`);
      logger.error('Please ensure firebase-service-account.json exists in the backend root directory');
      return;
    }

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error('Error initializing Firebase Admin SDK:', error);
  }
}

// Initialize Firebase on module load
initializeFirebase();

/**
 * Send push notification to user's mobile app using FCM V1 API
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<boolean>} - True if sent successfully
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    if (!firebaseInitialized) {
      logger.error('Firebase Admin SDK not initialized. Cannot send push notification.');
      return false;
    }

    const user = await User.findById(userId);
    
    if (!user || !user.pushToken) {
      logger.warn(`No push token found for user ${userId}`);
      return false;
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]); // FCM requires string values for data
          return acc;
        }, {}),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'omniagent_notifications',
          priority: 'high',
          visibility: 'public',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      token: user.pushToken,
    };

    const response = await admin.messaging().send(message);
    logger.info(`Push notification sent successfully to user ${userId}: ${response} - ${title}`);
    return true;
  } catch (error) {
    logger.error('Error sending push notification:', error.message || error);
    // Handle invalid token errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      logger.warn(`Invalid push token for user ${userId}, clearing token`);
      await User.findByIdAndUpdate(userId, { pushToken: null, pushTokenPlatform: null });
    }
    return false;
  }
}

/**
 * Send notification to all users in a company
 * @param {string} companyId - Company ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 */
async function sendPushNotificationToCompany(companyId, title, body, data = {}) {
  try {
    const users = await User.find({
      company: companyId,
      pushToken: { $ne: null },
      isActive: true,
    });

    const results = await Promise.allSettled(
      users.map(user => sendPushNotification(user._id, title, body, data))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    logger.info(`Sent push notifications to ${successCount}/${users.length} users in company ${companyId}`);
    
    return successCount;
  } catch (error) {
    logger.error('Error sending push notifications to company:', error);
    return 0;
  }
}

/**
 * Send notification when a visitor arrives on the website
 * This should be called from the chatbot widget or webhook
 * @param {string} companyId - Company ID (from chatbot)
 * @param {object} visitorInfo - Visitor information
 */
async function notifyWebsiteVisitor(companyId, visitorInfo = {}) {
  try {
    // Get total visitor count for the company
    const UserSession = require('../models/UserSession');
    const Chatbot = require('../models/Chatbot');
    
    // Get all chatbots for this company
    const chatbots = await Chatbot.find({ company: companyId });
    const chatbotIds = chatbots.map(cb => cb._id.toString());
    
    // Count unique visitors (total active sessions)
    const totalVisitors = await UserSession.countDocuments({
      chatbotId: { $in: chatbotIds },
      lastActivityAt: { 
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    });
    
    // Count unique visitors today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitorsToday = await UserSession.countDocuments({
      chatbotId: { $in: chatbotIds },
      createdAt: { $gte: today }
    });

    const title = '👤 New Website Visitor';
    const body = `Total Visitors: ${totalVisitors} (${visitorsToday} today)${visitorInfo.page ? ` • Page: ${visitorInfo.page}` : ''}`;
    
    const data = {
      type: 'website_visitor',
      companyId: companyId.toString(),
      timestamp: new Date().toISOString(),
      totalVisitors: totalVisitors.toString(),
      visitorsToday: visitorsToday.toString(),
      url: '/dashboard', // Navigate to dashboard when tapped
      ...visitorInfo,
    };

    return await sendPushNotificationToCompany(companyId, title, body, data);
  } catch (error) {
    logger.error('Error notifying website visitor:', error);
    return 0;
  }
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToCompany,
  notifyWebsiteVisitor,
};