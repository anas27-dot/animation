const mongoose = require('mongoose');

const leadCaptureSchema = new mongoose.Schema(
  {
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    phone: {
      type: String,
    },
    company: {
      type: String,
    },
    message: {
      type: String,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      source: String,
      referrer: String,
      userAgent: String,
    },
    crmSynced: {
      type: Boolean,
      default: false,
    },
    crmId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
leadCaptureSchema.index({ chatbotId: 1, createdAt: -1 });
leadCaptureSchema.index({ email: 1 });

module.exports = mongoose.model('LeadCapture', leadCaptureSchema);

