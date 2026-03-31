/**
 * Translation Controller
 * Handles Azure Translator API integration for chat summaries and transcripts
 */

const axios = require('axios');

// Azure Translator configuration
const AZURE_TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const AZURE_TRANSLATOR_ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
const AZURE_TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION || 'global';

/**
 * Get supported languages
 */
const getLanguages = async (req, res) => {
  try {
    if (!AZURE_TRANSLATOR_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Azure Translator key not configured'
      });
    }

    const response = await axios.get(`${AZURE_TRANSLATOR_ENDPOINT}/languages?api-version=3.0`, {
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      languages: response.data
    });
  } catch (error) {
    console.error('❌ [Translation] Error fetching languages:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported languages',
      details: error.message
    });
  }
};

/**
 * Translate text
 */
const translateText = async (req, res) => {
  try {
    const { texts, targetLanguage, sourceLanguage } = req.body;

    console.log('🔍 [Translation] Received request:', {
      textCount: texts?.length,
      targetLanguage,
      sourceLanguage,
      azureKeyConfigured: !!AZURE_TRANSLATOR_KEY,
      endpoint: AZURE_TRANSLATOR_ENDPOINT
    });

    if (!AZURE_TRANSLATOR_KEY) {
      console.error('❌ [Translation] Azure Translator key not configured in environment');
      return res.status(500).json({
        success: false,
        error: 'Azure Translator key not configured'
      });
    }

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'texts array is required and must not be empty'
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'targetLanguage is required'
      });
    }

    console.log('🔄 [Translation] Translating', texts.length, 'texts to', targetLanguage);
    console.log('📝 [Translation] Sample text:', texts[0]?.substring(0, 100));

    // Prepare request body for Azure Translator
    const requestBody = texts.map(text => ({
      text: text
    }));

    // Build URL with parameters
    let url = `${AZURE_TRANSLATOR_ENDPOINT}/translate?api-version=3.0&to=${targetLanguage}`;
    if (sourceLanguage && sourceLanguage !== 'auto') {
      url += `&from=${sourceLanguage}`;
    }

    // Log the exact request details
    console.log('🌐 [Translation] Azure API Request Details:');
    console.log('   URL:', url);
    console.log('   Method: POST');
    console.log('   Headers:', {
      'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY ? '[CONFIGURED]' : '[MISSING]',
      'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
      'Content-Type': 'application/json'
    });
    console.log('   Body:', JSON.stringify(requestBody, null, 2));

    console.log('🌐 [Translation] Calling Azure API:', url);

    const response = await axios.post(url, requestBody, {
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('📡 [Translation] Azure API response status:', response.status);
    console.log('📦 [Translation] Azure API response data:', JSON.stringify(response.data, null, 2));

    // Validate Azure response format
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      console.error('❌ [Translation] Invalid Azure response format - expected array');
      throw new Error('Invalid response format from Azure Translator API');
    }

    const firstItem = response.data[0];
    if (!firstItem.translations || !Array.isArray(firstItem.translations) || firstItem.translations.length === 0) {
      console.error('❌ [Translation] No translations found in Azure response');
      throw new Error('No translations returned from Azure Translator API');
    }

    // Process the response
    const translations = response.data.map((item, index) => {
      const originalText = texts[index];
      let translatedText = item.translations[0].text;

      // Clean up: Remove "(Original)" suffix if Azure adds it
      const parenRegex = /\s*\(([^)]+)\)$/;
      const match = translatedText.match(parenRegex);
      if (match && (match[1].toLowerCase() === originalText.toLowerCase() || originalText.toLowerCase().includes(match[1].toLowerCase()))) {
        translatedText = translatedText.replace(parenRegex, '').trim();
      }

      return {
        original: originalText,
        translated: translatedText,
        targetLanguage: targetLanguage,
        detectedLanguage: item.detectedLanguage ? item.detectedLanguage.language : null
      };
    });

    console.log('✅ [Translation] Successfully translated', translations.length, 'texts');
    console.log('🔤 [Translation] Sample translation:', translations[0]?.translated?.substring(0, 100));

    res.json({
      success: true,
      translations: translations
    });
  } catch (error) {
    console.error('❌ [Translation] Error translating text:', error.message);
    if (error.response) {
      console.error('❌ [Translation] Azure API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to translate text',
      details: error.message
    });
  }
};

/**
 * Translate transcript (chat messages)
 */
const translateTranscript = async (req, res) => {
  try {
    const { transcript, targetLanguage } = req.body;

    if (!AZURE_TRANSLATOR_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Azure Translator key not configured'
      });
    }

    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({
        success: false,
        error: 'transcript array is required'
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'targetLanguage is required'
      });
    }

    console.log('🔄 [Translation] Translating transcript with', transcript.length, 'messages to', targetLanguage);

    // Extract text content from transcript messages
    const texts = transcript.map(msg => {
      if (typeof msg === 'string') return msg;
      return msg.content || msg.text || msg.message || '';
    }).filter(text => text.trim().length > 0);

    if (texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No translatable text found in transcript'
      });
    }

    // Translate the texts
    const requestBody = texts.map(text => ({ text }));

    let url = `${AZURE_TRANSLATOR_ENDPOINT}/translate?api-version=3.0&to=${targetLanguage}`;

    const response = await axios.post(url, requestBody, {
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json'
      }
    });

    // Map translations back to original transcript structure
    const translatedTranscript = transcript.map((msg, index) => {
      const translation = response.data[index];
      if (!translation) return msg;

      const originalVal = typeof msg === 'string' ? msg : (msg.content || msg.text || msg.message);
      let translatedVal = translation.translations[0].text;

      // Clean up: Remove "(Original)" suffix
      const parenRegex = /\s*\(([^)]+)\)$/;
      const match = translatedVal.match(parenRegex);
      if (match && (match[1].toLowerCase() === originalVal.toLowerCase() || originalVal.toLowerCase().includes(match[1].toLowerCase()))) {
        translatedVal = translatedVal.replace(parenRegex, '').trim();
      }

      if (typeof msg === 'string') {
        return {
          original: msg,
          translated: translatedVal,
          language: targetLanguage
        };
      }

      return {
        ...msg,
        originalContent: originalVal,
        translatedContent: translatedVal,
        language: targetLanguage,
        detectedLanguage: translation.detectedLanguage ? translation.detectedLanguage.language : null
      };
    });

    console.log('✅ [Translation] Successfully translated transcript');

    res.json({
      success: true,
      transcript: translatedTranscript,
      targetLanguage: targetLanguage,
      messageCount: transcript.length
    });
  } catch (error) {
    console.error('❌ [Translation] Error translating transcript:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to translate transcript',
      details: error.message
    });
  }
};

/**
 * Test Azure Translator configuration
 */
const testTranslation = async (req, res) => {
  try {
    const configStatus = {
      azureKeyConfigured: !!AZURE_TRANSLATOR_KEY,
      azureKeyLength: AZURE_TRANSLATOR_KEY ? AZURE_TRANSLATOR_KEY.length : 0,
      azureEndpoint: AZURE_TRANSLATOR_ENDPOINT,
      azureRegion: AZURE_TRANSLATOR_REGION,
      timestamp: new Date().toISOString()
    };

    console.log('🔧 [Translation] Configuration test:', configStatus);

    if (!AZURE_TRANSLATOR_KEY) {
      return res.json({
        success: false,
        message: 'Azure Translator key not configured',
        config: configStatus
      });
    }

    // Test with a simple translation
    const testText = "Hello world";
    const testRequestBody = [{ text: testText }];
    const testUrl = `${AZURE_TRANSLATOR_ENDPOINT}/translate?api-version=3.0&to=es`;

    console.log('🧪 [Translation] Testing with Azure API...');

    const response = await axios.post(testUrl, testRequestBody, {
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const testResult = {
      success: true,
      message: 'Azure Translator API is working',
      testTranslation: {
        original: testText,
        translated: response.data[0].translations[0].text,
        targetLanguage: 'es'
      },
      config: configStatus
    };

    console.log('✅ [Translation] API test successful:', testResult.testTranslation);
    res.json(testResult);

  } catch (error) {
    console.error('❌ [Translation] API test failed:', error.message);
    res.json({
      success: false,
      message: 'Azure Translator API test failed',
      error: error.message,
      config: {
        azureKeyConfigured: !!AZURE_TRANSLATOR_KEY,
        azureEndpoint: AZURE_TRANSLATOR_ENDPOINT,
        azureRegion: AZURE_TRANSLATOR_REGION
      }
    });
  }
};

module.exports = {
  getLanguages,
  translateText,
  translateTranscript,
  testTranslation
};
