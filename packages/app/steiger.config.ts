import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Entities are referenced from the package root index (outside ./src),
    // so steiger's scanner won't see the references — suppress the false positive.
    files: ['./src/entities/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Feature slices contain only a hooks.ts file — deliberately flat.
    // FSD's canonical segment names (model, api, lib) would be over-engineered
    // for single-file mutation hooks; allow the current structure.
    files: ['./src/features/**'],
    rules: {
      'fsd/no-segmentless-slices': 'off',
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // We use descriptive segment names (hooks, types, schema, api) rather than
    // FSD's canonical set (model, ui, lib, config). The api.ts segment name
    // already matches; hooks/types/schema are intentionally kept descriptive.
    files: ['./src/**'],
    rules: {
      'fsd/segments-by-purpose': 'warn',
    },
  },
]);
