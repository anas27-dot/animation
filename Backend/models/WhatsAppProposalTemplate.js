const mongoose = require('mongoose');

const templateParamSchema = new mongoose.Schema({
  param_name: { type: String, required: true },
  param_value: { type: String, required: true },
  is_dynamic: { type: Boolean, default: false },
}, { _id: false });

const WhatsAppProposalTemplateSchema = new mongoose.Schema(
  {
    chatbot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    display_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    campaign_name: {
      type: String,
      required: true,
      trim: true,
    },
    template_name: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional AISensy config (overrides chatbot default and env vars)
    api_key: { type: String, default: null },
    org_slug: { type: String, default: null },
    sender_name: { type: String, default: null },
    country_code: { type: String, default: '91' },
    // Template parameters
    template_params: {
      type: [templateParamSchema],
      default: [],
    },
    // Optional media attachment
    media: {
      url: { type: String, default: null },
      filename: { type: String, default: null },
    },
    // Display settings
    order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
WhatsAppProposalTemplateSchema.index({ chatbot_id: 1, is_active: 1, order: 1 });

module.exports = mongoose.model('WhatsAppProposalTemplate', WhatsAppProposalTemplateSchema);
