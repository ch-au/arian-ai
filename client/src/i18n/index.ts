import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import deCommon from './de/common.json';
import deConfigure from './de/configure.json';
import deNegotiations from './de/negotiations.json';
import deAnalytics from './de/analytics.json';

const resources = {
  de: {
    common: deCommon,
    configure: deConfigure,
    negotiations: deNegotiations,
    analytics: deAnalytics,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'de',
    defaultNS: 'common',
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
