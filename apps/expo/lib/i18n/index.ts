import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

export const defaultNS = 'translation' as const;

/**
 * Translation resources keyed by locale then namespace.
 * Typed `as const` so TypeScript infers the exact shape of every key/value,
 * which is what the `CustomTypeOptions` module augmentation in `i18next.d.ts`
 * relies on for full compile-time key safety.
 */
export const resources = {
  en: { translation: en },
} as const;

i18next.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18next;

