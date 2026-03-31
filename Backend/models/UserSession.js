const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    phone: {
      type: String,
      index: true,
    },
    email: {
      type: String,
      index: true,
    },
    name: {
      type: String,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    isAuthenticated: {
      type: Boolean,
      default: false,
    },
    platform: {
      type: String,
      enum: ['web', 'whatsapp', 'mobile'],
      default: 'web',
    },
    language: {
      type: String,
      default: 'en',
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    leadCaptured: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      referrer: String,
      // Contact/follow-up related fields
      contacted: {
        type: Boolean,
        default: false,
      },
      contactedAt: Date,
      notes: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSessionSchema.index({ chatbotId: 1, lastActivityAt: -1 });
userSessionSchema.index({ userId: 1 });

module.exports = mongoose.model('UserSession', userSessionSchema);

