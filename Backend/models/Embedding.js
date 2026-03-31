const mongoose = require('mongoose');

const embeddingSchema = new mongoose.Schema(
  {
    chatbotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chatbot',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    contentHash: {
      type: String,
      index: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    metadata: {
      source: String,
      page: Number,
      chunkIndex: Number,
      title: String,
      url: String,
      updatedAt: Date
    },
  },
  {
    timestamps: true,
  }
);

// Index for vector search (MongoDB Atlas)
embeddingSchema.index({ embedding: '2dsphere' });
embeddingSchema.index({ chatbotId: 1 });
embeddingSchema.index({ chatbotId: 1, contentHash: 1 });
embeddingSchema.index({ chatbotId: 1, 'metadata.url': 1 });

module.exports = mongoose.model('Embedding', embeddingSchema);

