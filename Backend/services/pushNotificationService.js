const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logging');
const User = require('../models/User');

let firebaseInitialized = false;

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      logger.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON');
      return null;
    }
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
      logger.error('FIREBASE_SERVICE_ACCOUNT_BASE64 decode or JSON parse failed');
      return null;
    }
  }
  return null;
}

function loadServiceAccount() {
  const fromEnv = parseServiceAccountFromEnv();
  if (fromEnv) return fromEnv;

  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    return require(serviceAccountPath);
  }
  return null;
}

function initializeFirebase() {
  if (firebaseInitialized) {
    return;
  }

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      logger.warn(
        'Firebase not configured — push notifications disabled. ' +
          'Set FIREBASE_SERVICE_ACCOUNT_JSON (or BASE64) on the server, or add firebase-service-account.json locally.',
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error('Error initializing Firebase Admin SDK:', error.message || error);
  }
}

initializeFirebase();

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    if (!firebaseInitialized) {
      logger.debug('Skipping push: Firebase not initialized');
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
          acc[key] = String(data[key]);
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
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      logger.warn(`Invalid push token for user ${userId}, clearing token`);
      await User.findByIdAndUpdate(userId, { pushToken: null, pushTokenPlatform: null });
    }
    return false;
  }
}

async function sendPushNotificationToCompany(companyId, title, body, data = {}) {
  try {
    const users = await User.find({
      company: companyId,
      pushToken: { $ne: null },
      isActive: true,
    });

    const results = await Promise.allSettled(
      users.map((user) => sendPushNotification(user._id, title, body, data)),
    );

    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    logger.info(`Sent push notifications to ${successCount}/${users.length} users in company ${companyId}`);

    return successCount;
  } catch (error) {
    logger.error('Error sending push notifications to company:', error);
    return 0;
  }
}

async function notifyWebsiteVisitor(companyId, visitorInfo = {}) {
  try {
    const UserSession = require('../models/UserSession');
    const Chatbot = require('../models/Chatbot');

    const chatbots = await Chatbot.find({ company: companyId });
    const chatbotIds = chatbots.map((cb) => cb._id.toString());

    const totalVisitors = await UserSession.countDocuments({
      chatbotId: { $in: chatbotIds },
      lastActivityAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visitorsToday = await UserSession.countDocuments({
      chatbotId: { $in: chatbotIds },
      createdAt: { $gte: today },
    });

    const title = '👤 New Website Visitor';
    const body = `Total Visitors: ${totalVisitors} (${visitorsToday} today)${visitorInfo.page ? ` • Page: ${visitorInfo.page}` : ''}`;

    const data = {
      type: 'website_visitor',
      companyId: companyId.toString(),
      timestamp: new Date().toISOString(),
      totalVisitors: totalVisitors.toString(),
      visitorsToday: visitorsToday.toString(),
      url: '/dashboard',
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
