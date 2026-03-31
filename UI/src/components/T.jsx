import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/TranslationContext';
import { translateText, languageCodes } from '../services/translateService';

const T = ({ children }) => {
  const { currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const doTranslate = async () => {
      if (!children || typeof children !== 'string') {
        setTranslatedText(children);
        return;
      }

      console.log('🔄 T component translating:', children, 'to', currentLanguage);
      
      if (currentLanguage === 'English') {
        setTranslatedText(children);
        return;
      }
      
      const langCode = languageCodes[currentLanguage];
      if (!langCode) {
        setTranslatedText(children);
        return;
      }

      setIsLoading(true);
      try {
        const result = await translateText(children, langCode);
        setTranslatedText(result);
      } catch (error) {
        console.error('T component error:', error);
        setTranslatedText(children);
      } finally {
        setIsLoading(false);
      }
    };
    
    doTranslate();
  }, [children, currentLanguage]);
  
  return (
    <span className={isLoading ? 'opacity-50 transition-opacity' : ''}>
      {translatedText}
    </span>
  );
};

export default T;

