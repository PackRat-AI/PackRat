/**
 * Convenience re-export of the translation key type.
 *
 * The authoritative type safety comes from the `i18next.d.ts` module
 * augmentation in this directory, which wires `en.json` into i18next's
 * `CustomTypeOptions`.  This means i18next's own `t()` function and the
 * `useTranslation` hook automatically enforce correct keys — no manual
 * maintenance required.
 *
 * `TranslationKeys` is provided here as a convenience for the rare cases
 * where code outside of React components needs to refer to the key type
 * directly (e.g., prop types that accept a pre-translated key string).
 *
 * @see https://www.i18next.com/overview/typescript
 */

import type { ParseKeys } from 'i18next';

/** Union of every valid translation key derived from `en.json`. */
export type TranslationKeys = ParseKeys;

