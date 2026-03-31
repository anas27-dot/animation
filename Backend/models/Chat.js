const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    title: {
      type: String,
      default: function () {
        // Auto-generate title from first message
        return `Chat ${this._id.toString().slice(-6)}`;
      },
      maxlength: 100,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      unique: true,
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
    isActive: {
      type: Boolean,
      default: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    firstMessageAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      location: String,
      referrer: String,
      platform: {
        type: String,
        enum: ['web', 'whatsapp', 'mobile'],
        default: 'web',
      },
      language: {
        type: String,
        default: 'en',
      },
    },
    isAuthenticated: {
      type: Boolean,
      default: false,
    },
    tags: [{
      type: String,
      trim: true,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1, lastMessageAt: -1 });
chatSchema.index({ chatbotId: 1, createdAt: -1 });
chatSchema.index({ sessionId: 1 });
chatSchema.index({ conversationId: 1 });

// Virtual for conversation preview (first user message)
chatSchema.virtual('preview').get(function () {
  // This would be populated from the first user message
  return this.title || 'New conversation';
});

// Method to update message count and timestamps — Phone-Aware: one source of truth per person
chatSchema.methods.updateStats = async function () {
  console.log('🔄 [CHAT] Updating stats for conversation:', this._id);
  const Message = mongoose.model('Message');
  const UserSession = mongoose.model('UserSession');

  // 🎯 THE FIX: If this chat has a phone, count ALL messages for this phone (same person, any session).
  const query = this.phone
    ? { phone: this.phone, chatbotId: this.chatbotId }
    : { conversationId: this.conversationId, chatbotId: this.chatbotId };

  const messages = await Message.find(query).sort({ createdAt: 1 });

  if (messages.length > 0) {
    this.messageCount = messages.length;
    this.firstMessageAt = messages[0].createdAt;
    this.lastMessageAt = messages[messages.length - 1].createdAt;

    // SYNC PHONE: If Chat phone is missing, try to get it from messages or session
    if (!this.phone) {
      // Try messages first (most specific)
      const phoneMessage = messages.find(m => m.phone);
      if (phoneMessage) {
        this.phone = phoneMessage.phone;
        console.log('📱 [CHAT] Recovered phone from messages:', this.phone);
      } else {
        // Fallback to session
        const session = await UserSession.findOne({ sessionId: this.sessionId }).select('phone');
        if (session && session.phone) {
          this.phone = session.phone;
          console.log('📱 [CHAT] Recovered phone from session:', this.phone);
        }
      }
    }

    // Title must be from THIS conversation only (not the global first message for the phone).
    const messagesForTitle = this.phone
      ? messages.filter(m => String(m.conversationId) === String(this.conversationId))
      : messages;
    const firstUserMessage = messagesForTitle.find(m => m.role === 'user');
    console.log('📝 [CHAT] First user message found:', firstUserMessage?.content?.substring(0, 50));
    if (firstUserMessage && firstUserMessage.content) {
      let content = firstUserMessage.content;

      // Handle Vision API content stored as JSON strings
      if (typeof content === 'string' && content.trim().startsWith('[')) {
        try {
          const parsedContent = JSON.parse(content);
          if (Array.isArray(parsedContent)) {
            // Check if this is a Vision API message with an image
            const hasImage = parsedContent.some(item => item.type === 'image_url');
            const textPart = parsedContent.find(item => item.type === 'text');

            if (hasImage) {
              // This is an image analysis request
              const textContent = textPart?.text || '';
              if (textContent === 'Analyze this image' || textContent.trim() === '') {
                // Default prompt or no text means just an image upload
                this.title = 'Image';
              } else {
                // Custom text with image
                this.title = textContent.length > 50 ? textContent.substring(0, 47) + '...' : textContent;
              }
              return this.save();
            }
          }
        } catch (e) {
          // If parsing fails, treat as regular string
          console.log('⚠️ [CHAT] Failed to parse Vision API content, treating as string');
        }
      }

      const contentLower = content.toLowerCase().trim();

      // Only categorize greetings, keep everything else as original content
      if (/\b(hello|hi|hey|good\s+(morning|afternoon|evening|day))\b/i.test(contentLower)) {
        this.title = 'Greeting';
      } else {
        // For non-greetings, intelligently summarize long questions
        const originalContent = firstUserMessage.content;
        let summarizedTitle = originalContent;

        // Check for messages that need summarization (>10 words or contain specific patterns)
        const wordCount = contentLower.split(/\s+/).length;

        // Always check for summarization patterns, regardless of length
        let needsSummarization = false;

        if (/\b(contact|phone|email|address|location|reach|get in touch|details)\b/i.test(contentLower)) {
          summarizedTitle = 'Contact Details';
          needsSummarization = true;
        } else if (/\b(price|cost|pricing|fee|charge|rate|amount|money|payment|plans|packages)\b/i.test(contentLower)) {
          summarizedTitle = 'Pricing Information';
          needsSummarization = true;
        } else if (/\b(service|services|offer|provide|available|what do you|what.*do)\b/i.test(contentLower)) {
          summarizedTitle = 'Services Inquiry';
          needsSummarization = true;
        } else if (/\b(order|purchase|buy|product|item|delivery|shipping|place.*order)\b/i.test(contentLower)) {
          summarizedTitle = 'Order Inquiry';
          needsSummarization = true;
        } else if (/\b(help|support|assist|guidance|how to|trouble|need.*help)\b/i.test(contentLower)) {
          summarizedTitle = 'Help Request';
          needsSummarization = true;
        } else if (/\b(information|about|learn|know|tell me|more.*about)\b/i.test(contentLower)) {
          summarizedTitle = 'Information Request';
          needsSummarization = true;
        } else if (/\b(how|what|when|where|why|which|who)\b.*\?/i.test(contentLower)) {
          summarizedTitle = 'General Question';
          needsSummarization = true;
        } else if (wordCount > 15) {
          needsSummarization = true;
          // For very long messages without clear patterns, use first meaningful phrase
          const sentences = originalContent.split(/[.!?]+/);
          const firstSentence = sentences[0]?.trim();
          if (firstSentence && firstSentence.length > 10 && firstSentence.length < 60) {
            summarizedTitle = firstSentence;
          } else {
            // Extract first 40 characters as fallback
            summarizedTitle = originalContent.substring(0, 40) + '...';
          }
        }

        // If summarization was applied, use the summarized title
        if (needsSummarization) {
          // Keep the summarized title as-is
        } else {
          // For shorter messages that don't need summarization, use as-is but with reasonable length limit
          const maxTitleLength = 80;
          const titleContent = originalContent.substring(0, maxTitleLength);
          summarizedTitle = titleContent.length < originalContent.length ? `${titleContent}...` : titleContent;
        }

        this.title = summarizedTitle;
      }
    }
  }

  console.log(`📊 [STATS] Updated count to ${this.messageCount} for ${this.phone || this.sessionId}`);
  return this.save();
};

// Static method to find or create chat for session
chatSchema.statics.findOrCreateForSession = async function (sessionData) {
  const {
    sessionId,
    userId,
    phone,
    chatbotId,
    userAgent,
    ipAddress,
    location,
    referrer,
    platform = 'web',
    language = 'en'
  } = sessionData;

  let chat = await this.findOne({ conversationId: sessionData.conversationId });

  if (!chat) {
    chat = new this({
      sessionId,
      conversationId: sessionData.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      phone,
      chatbotId,
      metadata: {
        userAgent,
        ipAddress,
        location,
        referrer,
        platform,
        language,
      },
    });
    await chat.save();
  } else if (phone && !chat.phone) {
    // 🚨 THE SYNC FIX: If chat exists but phone is missing, add it now
    chat.phone = phone;
    await chat.save();
  }

  return chat;
};


module.exports = mongoose.model('Chat', chatSchema);
