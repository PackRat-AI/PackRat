import * as Localization from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';
import en from './locales/en.json';

// Create i18n instance
const i18n = new I18n();

// Set the key-value pairs for translations
i18n.translations = {
  en,
};

// Set the locale once at the beginning of your app
i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'en';

// When a value is missing from a language, it'll fall back to English
i18n.enableFallback = true;

// Default to lowercase locale tags for consistency
i18n.defaultLocale = 'en';

/**
 * Translate a key to its localized string
 * @param key - Translation key in dot notation (e.g., 'common.welcome')
 * @param options - Optional interpolation values
 * @returns Translated string
 */
export const t = (key: string, options?: TranslateOptions) => {
  return i18n.t(key, options);
};

export type Translate = typeof t;

export default i18n;
