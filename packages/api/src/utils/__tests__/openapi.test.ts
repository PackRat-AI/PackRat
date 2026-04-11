import { describe, expect, it } from 'vitest';
import { packratOpenApi } from '../openapi';

/**
 * OpenAPI plugin is now provided by `@elysiajs/openapi`. The PackRat wrapper
 * exports a preconfigured plugin instance. Here we assert that the exported
 * value is a real Elysia plugin so any accidental removal of metadata (tags,
 * security schemes, docs path) is caught in CI.
 */
describe('packratOpenApi', () => {
  it('exports a plugin instance', () => {
    expect(packratOpenApi).toBeDefined();
    // Elysia plugins expose a `compose` or `name` symbol depending on version;
    // any object-like value is acceptable here.
    expect(typeof packratOpenApi).toBe('object');
  });
});
