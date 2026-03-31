const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      index: true,
    },
    phone: {
      type: String,
      index: true,
    },
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,  // Changed from String to Mixed for Vision API support
      required: true,
    },
    language: {
      type: String,
      default: 'en',
    },
    intent: {
      type: String,
      enum: [
        'product_inquiry',
        'pricing_question',
        'booking_request',
        'support_request',
        'lead_capture',
        'general_query',
      ],
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
    tokens: {
      type: Number,
      default: 0,
    },
    processingTimeMs: {
      type: Number,
    },
    isAuthenticated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (phone + sessionId for phone-centric identity and performance)
messageSchema.index({ phone: 1, createdAt: -1 });
messageSchema.index({ sessionId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ chatbotId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

