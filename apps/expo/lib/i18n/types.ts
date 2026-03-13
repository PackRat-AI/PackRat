/**
 * TypeScript type definitions for i18n translation keys.
 *
 * `TranslationKeys` is automatically derived from `en.json` so that every key
 * added to the translation file is instantly available for type-checking and
 * autocomplete — no manual maintenance required.
 *
 * TypeScript will produce a compile-time error whenever code references a key
 * that does not exist in the English translation file, ensuring we are always
 * alerted to missing or mistyped translation values.
 */

import type { TranslateOptions } from 'i18n-js';
import type en from './locales/en.json';

/**
 * Recursively builds a union of all dot-notation paths through a nested
 * translation object.  Only string leaf values produce keys; intermediate
 * object nodes are not included so every key points to an actual translated
 * string.
 */
type NestedKeyOf<T extends Record<string, unknown>> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${K}.${NestedKeyOf<T[K] & Record<string, unknown>>}`
    : K;
}[keyof T & string];

/** Union of every valid translation key derived from `en.json`. */
export type TranslationKeys = NestedKeyOf<typeof en>;

/**
 * Type-safe translation function signature.
 * Usage: t('common.welcome') — autocompletes and type-checks all keys.
 */
export type TranslationFunction = (key: TranslationKeys, options?: TranslateOptions) => string;
