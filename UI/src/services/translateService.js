import axios from 'axios';
import config from '../config';

const API_BASE_URL = config.apiBaseUrl;

export const languageCodes = {
  'English': 'en',
  'Hindi': 'hi',
  'Marathi': 'mr',
  'Gujrati': 'gu',
  'Tamil': 'ta',
  'Telugu': 'te',
  'Kannada': 'kn'
};

export const translateText = async (text, targetLang, sourceLang = 'en') => {
  console.log('🔄 translateText called:', { text, targetLang, sourceLang });

  if (!text || targetLang === 'en' || targetLang === sourceLang) {
    console.log('⏭️ Skipping translation');
    return text;
  }

  try {
    console.log('📡 Calling API for translation...');
    const response = await axios.post(`${API_BASE_URL}/translate`, {
      text,
      targetLang,
      sourceLang
    });

    const translated = response.data.translatedText;
    console.log('✅ Translation result:', translated);
    return translated;
  } catch (error) {
    console.error('❌ Translation API error:', error);
    return text; // Fallback to original text
  }
};

