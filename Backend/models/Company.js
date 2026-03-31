const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      unique: true,
      sparse: true,
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Company credentials for admin management
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNo: {
      type: String,
      trim: true,
    },
    managed_by_name: {
      type: String,
      trim: true,
    },
    settings: {
      maxChatbots: {
        type: Number,
        default: 5,
      },
      features: {
        tts: {
          type: Boolean,
          default: false,
        },
        whatsapp: {
          type: Boolean,
          default: false,
        },
        analytics: {
          type: Boolean,
          default: true,
        },
      },
      crawler: {
        enabled: {
          type: Boolean,
          default: false,
        },
        schedule: {
          type: String,
          default: '0 0 * * *', // Fixed: 12:00 AM IST
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    credits: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null },
      notifications: {
        lowCredit100: { type: Boolean, default: false },
        lowCredit50: { type: Boolean, default: false },
        lowCredit10: { type: Boolean, default: false },
        exhausted: { type: Boolean, default: false },
        expiring7Days: { type: Boolean, default: false },
        expiring3Days: { type: Boolean, default: false },
        expiring1Day: { type: Boolean, default: false },
        expired: { type: Boolean, default: false },
      },
      history: [{
        type: { type: String, enum: ['add', 'remove', 'assign', 'use'], required: true },
        amount: { type: Number, required: true },
        duration: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null },
        reason: String,
        addedBy: String,
        removedBy: String,
        assignedBy: String,
        timestamp: { type: Date, default: Date.now },
      }],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Company', companySchema);

