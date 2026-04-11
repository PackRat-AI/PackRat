import type { Config } from 'tailwindcss';

/**
 * Shared Tailwind preset for PackRat web apps.
 *
 * Stub for the @packrat/web-ui package skeleton. A future PR will populate
 * this with the theme tokens / plugins currently duplicated between
 * apps/landing/tailwind.config.js and apps/guides/tailwind.config.ts, so both
 * apps can just extend this preset.
 */
export const webUiPreset = {
  content: [],
  theme: {},
} satisfies Partial<Config>;

export default webUiPreset;
