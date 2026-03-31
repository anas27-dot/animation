const mongoose = require("mongoose");

const EmailTemplateSchema = new mongoose.Schema({
  chatbot_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Chatbot", 
    required: true,
    index: true 
  },
  template_name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  email_subject: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  email_body: { 
    type: String, 
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  },
  order: { 
    type: Number, 
    default: 0 
  },
}, {
  timestamps: true
});

// Index for efficient queries
EmailTemplateSchema.index({ chatbot_id: 1, is_active: 1, order: 1 });

module.exports = mongoose.models.EmailTemplate || mongoose.model("EmailTemplate", EmailTemplateSchema);
