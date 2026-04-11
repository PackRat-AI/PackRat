import { beforeEach, describe, expect, it } from 'vitest';
import { apiEnvSchema, getEnv, validateCloudflareApiEnv } from '../env-validation';

// Minimal helper – returns a plain record matching the shape Elysia / Hono
// route handlers see for the Cloudflare Worker env bindings.
function makeRawEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ENVIRONMENT: 'production',
    SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
    NEON_DATABASE_URL: 'postgres://user:pass@host/db',
    NEON_DATABASE_URL_READONLY: 'postgres://user:pass@host/db',
    JWT_SECRET: 'secret',
    PASSWORD_RESET_SECRET: 'reset',
    GOOGLE_CLIENT_ID: 'google',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'pass',
    PACKRAT_API_KEY: 'key',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'resend',
    EMAIL_FROM: 'test@example.com',
    OPENAI_API_KEY: 'sk-test',
    GOOGLE_GENERATIVE_AI_API_KEY: 'google',
    AI_PROVIDER: 'openai',
    PERPLEXITY_API_KEY: 'pplx-test',
    OPENWEATHER_KEY: 'weather',
    WEATHER_API_KEY: 'weather-api',
    CLOUDFLARE_ACCOUNT_ID: 'cf',
    CLOUDFLARE_AI_GATEWAY_ID: 'gateway',
    R2_ACCESS_KEY_ID: 'access',
    R2_SECRET_ACCESS_KEY: 'secret',
    PACKRAT_BUCKET_R2_BUCKET_NAME: 'bucket',
    PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'guides',
    PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'scrapy',
    R2_PUBLIC_URL: 'https://r2.example.com',
    PACKRAT_GUIDES_RAG_NAME: 'rag',
    PACKRAT_GUIDES_BASE_URL: 'https://guides.example.com',
    CF_VERSION_METADATA: { id: 'version-1' },
    AI: {},
    PACKRAT_SCRAPY_BUCKET: {},
    PACKRAT_BUCKET: {},
    PACKRAT_GUIDES_BUCKET: {},
    ETL_QUEUE: {},
    LOGS_QUEUE: {},
    EMBEDDINGS_QUEUE: {},
    APP_CONTAINER: {},
    ...overrides,
  };
}

describe('env-validation', () => {
  beforeEach(() => {
    delete (process.env as Record<string, unknown>).NODE_ENV;
    delete (process.env as Record<string, unknown>).VITEST;
  });

  // -------------------------------------------------------------------------
  // apiEnvSchema validation
  // -------------------------------------------------------------------------
  describe('apiEnvSchema', () => {
    it('validates complete valid environment', () => {
      const result = apiEnvSchema.safeParse(makeRawEnv());
      expect(result.success).toBe(true);
    });

    it('defaults ENVIRONMENT to production', () => {
      const minimalEnv = makeRawEnv({ ENVIRONMENT: undefined });
      const result = apiEnvSchema.parse(minimalEnv);
      expect(result.ENVIRONMENT).toBe('production');
    });

    it('validates SENTRY_DSN as URL', () => {
      const result = apiEnvSchema.shape.SENTRY_DSN.safeParse('https://sentry.io/123');
      expect(result.success).toBe(true);
    });

    it('rejects invalid SENTRY_DSN', () => {
      const result = apiEnvSchema.shape.SENTRY_DSN.safeParse('not-a-url');
      expect(result.success).toBe(false);
    });

    it('validates OPENAI_API_KEY starts with sk-', () => {
      const result = apiEnvSchema.shape.OPENAI_API_KEY.safeParse('sk-test123');
      expect(result.success).toBe(true);
    });

    it('rejects OPENAI_API_KEY without sk- prefix', () => {
      const result = apiEnvSchema.shape.OPENAI_API_KEY.safeParse('invalid-key');
      expect(result.success).toBe(false);
    });

    it('validates PERPLEXITY_API_KEY starts with pplx-', () => {
      const result = apiEnvSchema.shape.PERPLEXITY_API_KEY.safeParse('pplx-test123');
      expect(result.success).toBe(true);
    });

    it('rejects PERPLEXITY_API_KEY without pplx- prefix', () => {
      const result = apiEnvSchema.shape.PERPLEXITY_API_KEY.safeParse('invalid');
      expect(result.success).toBe(false);
    });

    it('validates EMAIL_FROM as email', () => {
      const result = apiEnvSchema.shape.EMAIL_FROM.safeParse('test@example.com');
      expect(result.success).toBe(true);
    });

    it('rejects invalid EMAIL_FROM', () => {
      const result = apiEnvSchema.shape.EMAIL_FROM.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('validates AI_PROVIDER enum', () => {
      expect(apiEnvSchema.shape.AI_PROVIDER.safeParse('openai').success).toBe(true);
      expect(apiEnvSchema.shape.AI_PROVIDER.safeParse('cloudflare-workers-ai').success).toBe(true);
      expect(apiEnvSchema.shape.AI_PROVIDER.safeParse('invalid').success).toBe(false);
    });

    it('validates EMAIL_PROVIDER enum', () => {
      expect(apiEnvSchema.shape.EMAIL_PROVIDER.safeParse('resend').success).toBe(true);
      expect(apiEnvSchema.shape.EMAIL_PROVIDER.safeParse('sendgrid').success).toBe(true);
      expect(apiEnvSchema.shape.EMAIL_PROVIDER.safeParse('ses').success).toBe(true);
      expect(apiEnvSchema.shape.EMAIL_PROVIDER.safeParse('invalid').success).toBe(false);
    });

    it('validates CONTAINER_PORT as numeric string', () => {
      expect(apiEnvSchema.shape.CONTAINER_PORT.safeParse('8080').success).toBe(true);
      expect(apiEnvSchema.shape.CONTAINER_PORT.safeParse('3000').success).toBe(true);
    });

    it('rejects non-numeric CONTAINER_PORT', () => {
      const result = apiEnvSchema.shape.CONTAINER_PORT.safeParse('not-a-port');
      expect(result.success).toBe(false);
    });

    it('makes CONTAINER_PORT optional', () => {
      const result = apiEnvSchema.shape.CONTAINER_PORT.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getEnv function
  // -------------------------------------------------------------------------
  describe('getEnv', () => {
    it('returns validated environment in production when passed a context', () => {
      (process.env as Record<string, unknown>).NODE_ENV = 'production';
      const rawEnv = makeRawEnv();
      const result = getEnv({ env: rawEnv });
      expect(result.JWT_SECRET).toBe('secret');
      expect(result.ENVIRONMENT).toBe('production');
    });

    it('uses relaxed validation in test environment', () => {
      (process.env as Record<string, unknown>).NODE_ENV = 'test';
      const result = getEnv({ env: { JWT_SECRET: 'test-secret' } });
      expect(result.JWT_SECRET).toBe('test-secret');
      expect(result.ENVIRONMENT).toBe('development');
      expect(result.SENTRY_DSN).toBe('https://test@test.ingest.sentry.io/test');
    });

    it('detects Vitest environment', () => {
      process.env.VITEST = 'true';
      const result = getEnv({ env: {} });
      expect(result.ENVIRONMENT).toBe('development');
    });

    it('caches validated environment per raw env object', () => {
      (process.env as Record<string, unknown>).NODE_ENV = 'test';
      const rawEnv = { JWT_SECRET: 'secret' };
      const result1 = getEnv({ env: rawEnv });
      const result2 = getEnv({ env: rawEnv });
      expect(result1).toBe(result2); // Same instance
    });

    it('does not cache across different raw env objects', () => {
      (process.env as Record<string, unknown>).NODE_ENV = 'test';
      const result1 = getEnv({ env: { JWT_SECRET: 'secret' } });
      const result2 = getEnv({ env: { JWT_SECRET: 'secret' } });
      expect(result1).not.toBe(result2);
    });

    it('throws error for invalid environment in production', () => {
      (process.env as Record<string, unknown>).NODE_ENV = 'production';
      expect(() => getEnv({ env: { JWT_SECRET: 'secret' } })).toThrow(
        'Invalid environment variables',
      );
    });

    it('merges Cloudflare bindings from raw env', () => {
      (process.env as Record<string, unknown>).NODE_ENV = 'test';
      const mockAI = { run: () => null };
      const mockBucket = { get: () => null };
      const result = getEnv({
        env: { JWT_SECRET: 'secret', AI: mockAI, PACKRAT_BUCKET: mockBucket },
      });
      expect(result.AI).toBe(mockAI);
      expect(result.PACKRAT_BUCKET).toBe(mockBucket);
    });
  });

  // -------------------------------------------------------------------------
  // validateCloudflareApiEnv function
  // -------------------------------------------------------------------------
  describe('validateCloudflareApiEnv', () => {
    it('does not throw on valid environment', () => {
      expect(() => validateCloudflareApiEnv(makeRawEnv())).not.toThrow();
    });

    it('throws on missing required variable', () => {
      const invalid = makeRawEnv({ JWT_SECRET: undefined });
      expect(() => validateCloudflareApiEnv(invalid)).toThrow();
    });
  });
});
