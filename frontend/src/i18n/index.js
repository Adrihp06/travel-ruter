import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import es from './locales/es.json';

// Try to get saved language from localStorage
const getSavedLanguage = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('travel-ruter-settings') || '{}');
    return settings.language?.current || null;
  } catch {
    return null;
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: getSavedLanguage() || undefined,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'travel-ruter-language',
    },
  });

export default i18n;
