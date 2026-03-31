const mongoose = require('mongoose');
const logger = require('./config/logging');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

// Connection options
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let isConnected = false;

async function connect() {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, options);
    isConnected = true;
    logger.info('✅ MongoDB connected successfully');

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    isConnected = false;
    throw error;
  }
}

async function disconnect() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
    throw error;
  }
}

module.exports = {
  connect,
  disconnect,
  isConnected: () => isConnected,
};

