const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const fs = require('fs');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'chat-agent-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: nodeEnv === 'production' ? logFormat : consoleFormat,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Handle uncaught exceptions and unhandled rejections
if (nodeEnv === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  );
  logger.rejections.handle(
    new winston.transports.File({ filename: 'logs/rejections.log' })
  );
}

// Add CloudWatch transport if configured
if (process.env.AWS_REGION || nodeEnv === 'production') {
  logger.add(new WinstonCloudWatch({
    logGroupName: process.env.CLOUDWATCH_GROUP_NAME || 'ChatAgent/Backend/Logs',
    logStreamName: process.env.CLOUDWATCH_STREAM_NAME || `Instance-${nodeEnv}`,
    awsRegion: process.env.AWS_REGION || 'ap-south-1',
    jsonMessage: true,
    retentionInDays: 7
  }));
}

module.exports = logger;

