const redis = require('redis');
const logger = require('../config/logging');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

let client = null;

async function getClient() {
  if (client && client.isOpen) {
    return client;
  }

  try {
    client = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    });

    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    await client.connect();
    return client;
  } catch (error) {
    logger.error('Failed to create Redis client:', error);
    throw error;
  }
}

async function disconnect() {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
  }
}

module.exports = {
  getClient,
  disconnect,
};

