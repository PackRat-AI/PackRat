/**
 * Thin wrapper around react-i18next's `useTranslation` hook.
 *
 * Because the i18next instance is initialised with `initReactI18next` in
 * `lib/i18n/index.ts`, and the `CustomTypeOptions` augmentation in
 * `lib/i18n/i18next.d.ts` wires `en.json` into i18next's type system,
 * the `t` function returned by this hook is already fully type-safe:
 * TypeScript will error on any unknown or misspelled translation key.
 *
 * A thin wrapper is kept here (rather than re-exporting react-i18next
 * directly) to preserve a single import path for consumers and to allow
 * app-specific behaviour (e.g. locale-change side-effects) to be added
 * without touching callsites.
 *
 * Usage:
 * ```tsx
 * import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
 *
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <Text>{t('common.welcome')}</Text>;
 * }
 * ```
 */
import { useTranslation as useI18nextTranslation } from 'react-i18next';

export function useTranslation() {
  return useI18nextTranslation();
}
