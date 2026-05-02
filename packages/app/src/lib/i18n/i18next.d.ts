/**
 * i18next TypeScript module augmentation.
 *
 * By declaring `CustomTypeOptions` here we plug the shape of our translation
 * resources directly into i18next's type system.  After this, the `t()`
 * function — whether called from `i18next.t()`, `useTranslation().t`, or the
 * `Trans` component — will only accept keys that exist in `en.json` and will
 * report a compile-time error for any unknown or misspelled key.
 *
 * @see https://www.i18next.com/overview/typescript
 */

import 'i18next';
import type { defaultNS, resources } from './index';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
