const { getClient } = require('../lib/redis');
const logger = require('../config/logging');

const SESSION_TTL = 3600; // 1 hour
const CACHE_TTL = 300; // 5 minutes

async function getSession(sessionId) {
  try {
    const client = await getClient();
    const data = await client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis session get error:', error);
    return null;
  }
}

async function setSession(sessionId, data) {
  try {
    const client = await getClient();
    await client.setEx(`session:${sessionId}`, SESSION_TTL, JSON.stringify(data));
  } catch (error) {
    logger.error('Redis session set error:', error);
  }
}

async function deleteSession(sessionId) {
  try {
    const client = await getClient();
    await client.del(`session:${sessionId}`);
  } catch (error) {
    logger.error('Redis session delete error:', error);
  }
}

async function getCachedResponse(cacheKey) {
  try {
    const client = await getClient();
    const data = await client.get(`cache:${cacheKey}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis cache get error:', error);
    return null;
  }
}

async function setCachedResponse(cacheKey, data) {
  try {
    const client = await getClient();
    await client.setEx(`cache:${cacheKey}`, CACHE_TTL, JSON.stringify(data));
  } catch (error) {
    logger.error('Redis cache set error:', error);
  }
}

module.exports = {
  getSession,
  setSession,
  deleteSession,
  getCachedResponse,
  setCachedResponse,
};

