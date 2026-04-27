/**
 * Convenience re-export of the translation key and function types.
 *
 * The authoritative type safety comes from the `i18next.d.ts` module
 * augmentation in this directory, which wires `en.json` into i18next's
 * `CustomTypeOptions`.  This means i18next's own `t()` function and the
 * `useTranslation` hook automatically enforce correct keys — no manual
 * maintenance required.
 *
 * @see https://www.i18next.com/overview/typescript
 */

import type { ParseKeys, TFunction } from 'i18next';

/** Union of every valid translation key derived from `en.json`. */
export type TranslationKeys = ParseKeys;

/**
 * Type of a `t()` function that accepts only valid translation keys.
 * Use this to annotate parameters/props that receive `t` from
 * `useTranslation()` or the named export from `app/lib/i18n`.
 *
 * Example:
 * ```ts
 * import type { TranslationFunction } from 'app/lib/i18n/types';
 * function getOptions(t: TranslationFunction) { ... }
 * ```
 */
export type TranslationFunction = TFunction;
