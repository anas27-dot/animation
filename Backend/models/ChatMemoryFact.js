const mongoose = require('mongoose');

const chatMemoryFactSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  chatbotId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true },
  sourceSessionId: { type: String, default: '' },
  phone: { type: String, default: null },
  is_authenticated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

chatMemoryFactSchema.index({ userId: 1, chatbotId: 1 });

module.exports = mongoose.model('ChatMemoryFact', chatMemoryFactSchema);
