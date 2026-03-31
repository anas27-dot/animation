// Language detection service using OpenAI
const openai = require('../config/openai');
const logger = require('../config/logging');

/**
 * Detect language and script from text using OpenAI
 * @param {string} text - Text to analyze
 * @returns {Promise<{language: string, script: string, confidence: number}>} - Detected details
 */
async function detectLanguage(text) {
  try {
    if (!text || text.trim().length === 0) {
      return { language: 'English', script: 'Latin', confidence: 1.0 };
    }

    // Detect script locally to ensure 100% accuracy (OpenAI often hallucinates script types)
    // Indian Unicode ranges cover \u0900 (Devanagari) through \u0D7F (Malayalam)
    const hasNativeScript = /[\u0900-\u0D7F]/.test(text);
    const script = hasNativeScript ? 'Native' : 'Latin';

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Identify the user's primary language (e.g., Hindi, Gujarati, English, Marathi, Tamil, etc.). Return strictly JSON.\nFormat: { \"language\": \"string\" }"
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 50
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Combine OpenAI's language result with local script detection
    const detectedLanguageObj = {
      language: result.language || 'English',
      script: script
    };

    logger.info(`🌍 [Language Detection] Detected: ${JSON.stringify(detectedLanguageObj)} for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    return detectedLanguageObj;
  } catch (error) {
    logger.error('Error in language detection:', error);
    return { language: 'English', script: 'Latin', confidence: 0.5 }; // Fallback
  }
}

/**
 * Check if text is likely English (Legacy/Helper)
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
async function isEnglish(text) {
  try {
    const result = await detectLanguage(text);
    return result.language.toLowerCase() === 'english';
  } catch (e) {
    return true;
  }
}

/**
 * Translate text to target language using OpenAI
 * @param {string} text - Text to translate (usually in English)
 * @param {string} targetLanguage - Target language (e.g., "Hindi", "Marathi")
 * @param {string} targetScript - Target script ("Latin" for romanized, "Native" for native script)
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, targetLanguage, targetScript = 'Latin') {
  try {
    // If target is English, return as-is
    if (targetLanguage.toLowerCase() === 'english') {
      return text;
    }

    // Build script instruction
    const scriptInstruction = targetScript === 'Latin'
      ? `Use ONLY Latin/Roman script (romanized ${targetLanguage}, like Hinglish for Hindi).`
      : `Use native ${targetLanguage} script (Devanagari for Hindi, Tamil script for Tamil, etc.).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text to ${targetLanguage}.
${scriptInstruction}
Maintain the tone and formality of the original text.
Return ONLY the translated text, nothing else.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0,
      max_tokens: 200
    });

    const translatedText = response.choices[0].message.content.trim();
    logger.info(`🌐 [Translation] "${text.substring(0, 50)}..." → ${targetLanguage} (${targetScript}): "${translatedText.substring(0, 50)}..."`);
    return translatedText;
  } catch (error) {
    logger.error('Error in translation:', error);
    return text; // Fallback to original text
  }
}

module.exports = {
  detectLanguage,
  isEnglish,
  translateText
};
