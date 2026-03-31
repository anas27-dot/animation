import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translateText, languageCodes } from '../services/translateService';

const TranslationContext = createContext();

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const TranslationProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(
    localStorage.getItem('preferredLanguage') || 'English'
  );
  const [translations, setTranslations] = useState({});

  const changeLanguage = async (newLanguage) => {
    console.log('🌍 Changing language to:', newLanguage);
    setCurrentLanguage(newLanguage);
    // Clear cache to force re-translation
    setTranslations({});
    localStorage.setItem('preferredLanguage', newLanguage);
  };

  const t = useCallback(async (text) => {
    if (currentLanguage === 'English' || !text) return text;
    
    const langCode = languageCodes[currentLanguage];
    if (!langCode) return text;

    if (translations[text]) return translations[text];

    const translated = await translateText(text, langCode);
    setTranslations(prev => ({ ...prev, [text]: translated }));
    return translated;
  }, [currentLanguage, translations]);

  const value = {
    currentLanguage,
    changeLanguage,
    translations,
    setTranslations,
    t
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

