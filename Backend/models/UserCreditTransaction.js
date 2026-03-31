const mongoose = require('mongoose');

const userCreditTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  chatbot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chatbot',
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: [
      'message_deduction',
      'admin_add',
      'admin_remove',
      'reset',
      'renewal_bonus',
      'initial_allocation'
    ]
  },
  amount: {
    type: Number,
    required: true
  },
  balance_after: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  session_id: {
    type: String,
    default: null
  },
  admin: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    name: {
      type: String,
      default: null
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
userCreditTransactionSchema.index({ user: 1, created_at: -1 });
userCreditTransactionSchema.index({ company: 1, created_at: -1 });

module.exports = mongoose.model('UserCreditTransaction', userCreditTransactionSchema);
