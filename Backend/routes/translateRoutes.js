const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/', async (req, res) => {
    try {
        const { text, targetLang, sourceLang = 'en' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        console.log(`🌍 [Translation] Request: "${text.substring(0, 30)}..." to ${targetLang}`);

        // Get credentials from environment
        const key = process.env.AZURE_TRANSLATOR_KEY;
        const region = process.env.AZURE_TRANSLATOR_REGION;
        const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';

        if (!key) {
            console.warn('⚠️ [Translation] Azure key missing, returning original');
            return res.json({ success: true, translatedText: text });
        }

        // Call Azure Translator directly for maximum reliability
        const response = await axios.post(
            `${endpoint}/translate?api-version=3.0&to=${targetLang}&from=${sourceLang}`,
            [{ text }],
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': key,
                    'Ocp-Apim-Subscription-Region': region,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }
        );

        if (response.data && response.data[0] && response.data[0].translations[0]) {
            const translatedText = response.data[0].translations[0].text;

            // Clean up: Azure sometimes returns "Translation (Original)" for technical terms
            // We want to remove the "(Original)" part if it matches our input text
            let cleanedText = translatedText;
            const parenRegex = /\s*\(([^)]+)\)$/;
            const match = cleanedText.match(parenRegex);

            if (match && (match[1].toLowerCase() === text.toLowerCase() || text.toLowerCase().includes(match[1].toLowerCase()))) {
                cleanedText = cleanedText.replace(parenRegex, '').trim();
            }

            console.log(`✅ [Translation] Success: "${cleanedText}"`);
            return res.json({
                success: true,
                translatedText: cleanedText
            });
        }

        console.warn('⚠️ [Translation] Unexpected Azure response format');
        res.json({ success: true, translatedText: text });

    } catch (error) {
        console.error('❌ [Translation] API Error:', error.response?.data || error.message);
        // Silently fallback to original text to avoid breaking UI components
        res.json({
            success: true,
            translatedText: req.body.text || ''
        });
    }
});

module.exports = router;
