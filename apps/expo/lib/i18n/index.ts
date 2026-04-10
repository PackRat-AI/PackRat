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

// Guard against re-initialisation on Fast Refresh or multiple module evaluations.
if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources,
    lng: Localization.getLocales()[0]?.languageCode ?? 'en',
    fallbackLng: 'en',
    defaultNS,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });
}

/**
 * Convenience `t` function for use outside of React components (e.g. utility
 * functions, validation helpers).  It delegates to the configured i18next
 * instance so initialisation is guaranteed whenever this module is imported.
 *
 * Usage:
 * ```ts
 * import { t } from 'expo-app/lib/i18n';
 * const msg = t('errors.somethingWentWrong');
 * ```
 */
export const t = i18next.t.bind(i18next);

export default i18next;
