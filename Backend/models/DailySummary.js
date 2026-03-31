const mongoose = require('mongoose');

const dailySummarySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    chatbotName: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    sessionCount: {
      type: Number,
      default: 0,
    },
    topTopics: {
      type: [String],
      default: [],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one summary per chatbot per day
dailySummarySchema.index({ chatbotId: 1, date: 1 }, { unique: true });
// Also index by company for faster queries (non-unique)
dailySummarySchema.index({ company: 1, date: -1 });

// Method to get date string in YYYY-MM-DD format
dailySummarySchema.methods.getDateString = function() {
  return this.date.toISOString().split('T')[0];
};

module.exports = mongoose.model('DailySummary', dailySummarySchema);
