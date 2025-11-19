import * as Localization from 'expo-localization';
import { useEffect, useState } from 'react';
import i18n from '../i18n';
import type { TranslateOptions } from 'i18n-js';

/**
 * Custom hook for accessing translations
 * Provides the translate function and current locale
 * Re-renders component when locale changes
 */
export function useTranslation() {
  const [locale, setLocale] = useState(i18n.locale);

  useEffect(() => {
    // Listen for locale changes (if implemented)
    const currentLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
    if (currentLocale !== locale) {
      i18n.locale = currentLocale;
      setLocale(currentLocale);
    }
  }, [locale]);

  /**
   * Translate function
   * @param key - Translation key in dot notation (e.g., 'common.welcome')
   * @param options - Optional interpolation values
   * @returns Translated string
   */
  const t = (key: string, options?: TranslateOptions) => {
    return i18n.t(key, options);
  };

  return { t, locale };
}
