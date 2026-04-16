import { env, resetEnv } from '@packrat/analytics/core/env';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => resetEnv());

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  resetEnv();
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetEnv();
  }
}

describe('env validation', () => {
  it('rejects invalid ANALYTICS_MODE', () => {
    withEnv(
      { ANALYTICS_MODE: 'invalid_mode', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test' },
      () => expect(() => env()).toThrow(),
    );
  });

  it('requires S3 creds in local mode', () => {
    withEnv(
      { ANALYTICS_MODE: 'local', R2_ACCESS_KEY_ID: undefined, R2_SECRET_ACCESS_KEY: undefined },
      () => expect(() => env()).toThrow(/R2_ACCESS_KEY_ID/),
    );
  });

  it('requires Iceberg creds in catalog mode', () => {
    withEnv(
      {
        ANALYTICS_MODE: 'catalog',
        R2_CATALOG_TOKEN: undefined,
        R2_CATALOG_URI: undefined,
        R2_WAREHOUSE_NAME: undefined,
      },
      () => expect(() => env()).toThrow(/R2_CATALOG_TOKEN/),
    );
  });

  it('accepts valid local config', () => {
    withEnv(
      {
        ANALYTICS_MODE: 'local',
        R2_ACCESS_KEY_ID: 'test-key',
        R2_SECRET_ACCESS_KEY: 'test-secret',
      },
      () => {
        const config = env();
        expect(config.ANALYTICS_MODE).toBe('local');
        expect(config.R2_ACCESS_KEY_ID).toBe('test-key');
      },
    );
  });

  it('accepts valid catalog config', () => {
    withEnv(
      {
        ANALYTICS_MODE: 'catalog',
        R2_CATALOG_TOKEN: 'tok-123',
        R2_CATALOG_URI: 'https://example.r2.cloudflarestorage.com',
        R2_WAREHOUSE_NAME: 'test-warehouse',
      },
      () => {
        const config = env();
        expect(config.ANALYTICS_MODE).toBe('catalog');
        expect(config.R2_CATALOG_TOKEN).toBe('tok-123');
        expect(config.R2_CATALOG_URI).toBe('https://example.r2.cloudflarestorage.com');
        expect(config.R2_WAREHOUSE_NAME).toBe('test-warehouse');
      },
    );
  });

  it('does not require Iceberg creds when mode is local', () => {
    withEnv(
      {
        ANALYTICS_MODE: 'local',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_CATALOG_TOKEN: undefined,
      },
      () => expect(() => env()).not.toThrow(),
    );
  });

  it('does not require S3 creds when mode is catalog', () => {
    withEnv(
      {
        ANALYTICS_MODE: 'catalog',
        R2_CATALOG_TOKEN: 'tok',
        R2_CATALOG_URI: 'https://example.com',
        R2_WAREHOUSE_NAME: 'wh',
        R2_ACCESS_KEY_ID: undefined,
        R2_SECRET_ACCESS_KEY: undefined,
      },
      () => expect(() => env()).not.toThrow(),
    );
  });

  it('defaults ANALYTICS_MODE to local when unset', () => {
    withEnv(
      {
        ANALYTICS_MODE: undefined,
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
      },
      () => {
        const config = env();
        expect(config.ANALYTICS_MODE).toBe('local');
      },
    );
  });
});
