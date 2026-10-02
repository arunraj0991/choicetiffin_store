import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import { Lang, TKey, strings } from './translations';

interface LangCtx {
  language:    Lang;
  setLanguage: (lang: Lang) => Promise<void>;
  t:           (key: TKey) => string;
  isRTL:       boolean;
}

const LanguageContext = createContext<LangCtx>({
  language:    'en',
  setLanguage: async () => {},
  t:           key => key,
  isRTL:       false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem('app_language').then(saved => {
      if (saved && ['en', 'es', 'fr', 'ar'].includes(saved)) {
        const lang = saved as Lang;
        setLang(lang);
        I18nManager.allowRTL(lang === 'ar');
        I18nManager.forceRTL(lang === 'ar');
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: Lang) => {
    setLang(lang);
    await AsyncStorage.setItem('app_language', lang);
    I18nManager.allowRTL(lang === 'ar');
    I18nManager.forceRTL(lang === 'ar');
  }, []);

  const t = useCallback(
    (key: TKey): string => strings[language][key] ?? strings['en'][key] ?? key,
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL: language === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
