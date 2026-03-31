const mongoose = require("mongoose");

const phoneUserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true
    },
    // ✅ CRITICAL: This field was likely missing or undefined
    name: {
      type: String,
      trim: true,
      default: "User"
    },
    otp: String,
    otpExpiresAt: Date,
    verified: {
      type: Boolean,
      default: false
    },
    chatbotId: {
      type: String,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

// Create compound index for faster lookups
phoneUserSchema.index({ phone: 1, chatbotId: 1 });

module.exports = mongoose.model("PhoneUser", phoneUserSchema);