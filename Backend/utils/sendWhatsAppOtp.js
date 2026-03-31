const axios = require("axios");

/**
 * Send OTP via WhatsApp using AiSensy API
 * @param {string} phone - Phone number (will be normalized)
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendWhatsAppOtp = async (phone, otp) => {
    // Check if API key is configured
    if (!process.env.AISENSY_API_KEY) {
        console.error("❌ AISENSY_API_KEY is not configured in environment variables");
        throw new Error("WhatsApp API key is not configured. Please contact support.");
    }

    // Normalize phone number - remove all non-digits
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone || normalizedPhone.length < 10) {
        console.error("❌ Invalid phone number:", phone);
        throw new Error("Invalid phone number format");
    }

    const payload = {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName: "Signup OTP Campaign",
        destination: `91${normalizedPhone}`, // without + sign, add country code
        userName: "Troika Tech Services",
        templateParams: [otp],
        source: "Supa Agent",
        media: {},
        buttons: [
            {
                type: "button",
                sub_type: "url",
                index: 0,
                parameters: [
                    {
                        type: "text",
                        text: otp,
                    },
                ],
            },
        ],
        carouselCards: [],
        location: {},
        attributes: {},
    };

    try {
        console.log(`📤 Sending OTP to ${payload.destination} via AiSensy API`);
        const res = await axios.post(
            "https://backend.api-wa.co/campaign/troika-tech-services/api/v2",
            payload,
            { headers: { "Content-Type": "application/json" } }
        );

        if (res.status === 200) {
            console.log("✅ WhatsApp OTP sent successfully");
            return true;
        } else {
            console.error("❌ Unexpected response status:", res.status, res.data);
            throw new Error(`Unexpected response from WhatsApp API: ${res.status}`);
        }
    } catch (err) {
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        const statusCode = err.response?.status;

        console.error("❌ WhatsApp OTP Error:", {
            status: statusCode,
            message: errorMessage,
            data: err.response?.data,
            phone: payload.destination
        });

        // Provide user-friendly error messages
        let userFriendlyMessage = errorMessage;

        if (errorMessage && errorMessage.toLowerCase().includes('opted-out')) {
            userFriendlyMessage = "This number has opted out of receiving WhatsApp messages. Please contact support to opt-in or use a different number.";
        } else if (errorMessage && errorMessage.toLowerCase().includes('invalid')) {
            userFriendlyMessage = "Invalid phone number. Please check and try again.";
        } else if (statusCode === 400) {
            userFriendlyMessage = errorMessage || "Unable to send OTP. Please verify your number or contact support.";
        } else if (statusCode === 429) {
            userFriendlyMessage = "Too many requests. Please try again after some time.";
        } else {
            userFriendlyMessage = errorMessage || "Failed to send WhatsApp OTP. Please try again or contact support.";
        }

        throw new Error(userFriendlyMessage);
    }
};

module.exports = sendWhatsAppOtp;
