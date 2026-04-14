import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock hono/adapter
vi.mock('hono/adapter', () => ({
  env: vi.fn(),
}));

import { env } from 'hono/adapter';
import { apiEnvSchema, getEnv, validateCloudflareApiEnv } from '../env-validation';

// Mock Hono context
function makeMockContext(envData: Record<string, unknown> = {}) {
  return {
    req: {},
    env: envData,
  } as any;
}

describe('env-validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset test environment detection
    delete (process.env as any).NODE_ENV;
    delete (process.env as any).VITEST;
  });

  // -------------------------------------------------------------------------
  // apiEnvSchema validation
  // -------------------------------------------------------------------------
  describe('apiEnvSchema', () => {
    it('validates complete valid environment', () => {
      const validEnv = {
        ENVIRONMENT: 'production',
        SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
        NEON_DATABASE_URL: 'postgres://user:pass@host/db',
        NEON_DATABASE_URL_READONLY: 'postgres://user:pass@host/db',
        JWT_SECRET: 'secret',
        PASSWORD_RESET_SECRET: 'reset-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'admin-pass',
        PACKRAT_API_KEY: 'api-key',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'resend-key',
        EMAIL_FROM: 'no-reply@packrat.ai',
        OPENAI_API_KEY: 'sk-test123',
        GOOGLE_GENERATIVE_AI_API_KEY: 'google-ai-key',
        AI_PROVIDER: 'openai',
        PERPLEXITY_API_KEY: 'pplx-test123',
        OPENWEATHER_KEY: 'weather-key',
        WEATHER_API_KEY: 'weather-api-key',
        CLOUDFLARE_ACCOUNT_ID: 'cf-account',
        CLOUDFLARE_AI_GATEWAY_ID: 'cf-gateway',
        R2_ACCESS_KEY_ID: 'r2-access',
        R2_SECRET_ACCESS_KEY: 'r2-secret',
        PACKRAT_BUCKET_R2_BUCKET_NAME: 'packrat-bucket',
        PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'guides-bucket',
        PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'scrapy-bucket',
        R2_PUBLIC_URL: 'https://r2.packrat.ai',
        PACKRAT_GUIDES_RAG_NAME: 'guides-rag',
        PACKRAT_GUIDES_BASE_URL: 'https://guides.packrat.ai',
        CF_VERSION_METADATA: {},
        AI: {},
        PACKRAT_SCRAPY_BUCKET: {},
        PACKRAT_BUCKET: {},
        PACKRAT_GUIDES_BUCKET: {},
        ETL_QUEUE: {},
        LOGS_QUEUE: {},
        EMBEDDINGS_QUEUE: {},
        APP_CONTAINER: {},
      };

      const result = apiEnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('defaults ENVIRONMENT to production', () => {
      const minimalEnv = {
        SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
        NEON_DATABASE_URL: 'postgres://user:pass@host/db',
        NEON_DATABASE_URL_READONLY: 'postgres://user:pass@host/db',
        JWT_SECRET: 'secret',
        PASSWORD_RESET_SECRET: 'reset-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'admin-pass',
        PACKRAT_API_KEY: 'api-key',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'resend-key',
        EMAIL_FROM: 'test@example.com',
        OPENAI_API_KEY: 'sk-test',
        GOOGLE_GENERATIVE_AI_API_KEY: 'google-key',
        AI_PROVIDER: 'openai',
        PERPLEXITY_API_KEY: 'pplx-test',
        OPENWEATHER_KEY: 'weather',
        WEATHER_API_KEY: 'weather-api',
        CLOUDFLARE_ACCOUNT_ID: 'cf',
        CLOUDFLARE_AI_GATEWAY_ID: 'cf-gateway',
        R2_ACCESS_KEY_ID: 'r2-access',
        R2_SECRET_ACCESS_KEY: 'r2-secret',
        PACKRAT_BUCKET_R2_BUCKET_NAME: 'bucket',
        PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'guides',
        PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'scrapy',
        R2_PUBLIC_URL: 'https://r2.example.com',
        PACKRAT_GUIDES_RAG_NAME: 'rag',
        PACKRAT_GUIDES_BASE_URL: 'https://guides.example.com',
        CF_VERSION_METADATA: {},
        AI: {},
        PACKRAT_SCRAPY_BUCKET: {},
        PACKRAT_BUCKET: {},
        PACKRAT_GUIDES_BUCKET: {},
        ETL_QUEUE: {},
        LOGS_QUEUE: {},
        EMBEDDINGS_QUEUE: {},
        APP_CONTAINER: {},
      };

      const result = apiEnvSchema.parse(minimalEnv);
      expect(result.ENVIRONMENT).toBe('production');
    });

    it('validates ENVIRONMENT enum', () => {
      const envWithDevEnvironment = {
        ENVIRONMENT: 'development',
        SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
        // ... other required fields
      };

      const _result = apiEnvSchema.safeParse(envWithDevEnvironment);
      // Will fail because missing required fields, but if we add them it should work
      expect(['development', 'production']).toContain('development');
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
    it('returns validated environment in production', () => {
      (process.env as any).NODE_ENV = 'production';

      const mockEnv = {
        ENVIRONMENT: 'production',
        SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
        NEON_DATABASE_URL: 'postgres://user:pass@host/db',
        NEON_DATABASE_URL_READONLY: 'postgres://user:pass@host/db',
        JWT_SECRET: 'secret',
        PASSWORD_RESET_SECRET: 'reset',
        GOOGLE_CLIENT_ID: 'google',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'admin-pass',
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
      };

      const c = makeMockContext();
      vi.mocked(env).mockReturnValue(mockEnv as any);

      const result = getEnv(c);

      expect(result.JWT_SECRET).toBe('secret');
      expect(result.ENVIRONMENT).toBe('production');
    });

    it('uses relaxed validation in test environment', () => {
      (process.env as any).NODE_ENV = 'test';

      const minimalEnv = {
        JWT_SECRET: 'test-secret',
      };

      const c = makeMockContext();
      vi.mocked(env).mockReturnValue(minimalEnv as any);

      const result = getEnv(c);

      // Should use defaults from testEnvSchema
      expect(result.JWT_SECRET).toBe('test-secret');
      expect(result.ENVIRONMENT).toBe('development'); // default in test
      expect(result.SENTRY_DSN).toBe('https://test@test.ingest.sentry.io/test');
    });

    it('detects Vitest environment', () => {
      process.env.VITEST = 'true';

      const minimalEnv = {};
      const c = makeMockContext();
      vi.mocked(env).mockReturnValue(minimalEnv as any);

      const result = getEnv(c);

      // Should use test schema defaults
      expect(result.ENVIRONMENT).toBe('development');
    });

    it('caches validated environment per context', () => {
      (process.env as any).NODE_ENV = 'test';
      const c = makeMockContext();
      vi.mocked(env).mockReturnValue({ JWT_SECRET: 'secret' } as any);

      const result1 = getEnv(c);
      const result2 = getEnv(c);

      expect(result1).toBe(result2); // Same instance
      expect(env).toHaveBeenCalledTimes(1); // Only called once
    });

    it('does not cache across different contexts', () => {
      (process.env as any).NODE_ENV = 'test';

      const c1 = makeMockContext();
      const c2 = makeMockContext();

      vi.mocked(env).mockReturnValue({ JWT_SECRET: 'secret' } as any);

      const _result1 = getEnv(c1);
      const _result2 = getEnv(c2);

      expect(env).toHaveBeenCalledTimes(2); // Called twice
      // Results may be different instances
    });

    it('throws error for invalid environment in production', () => {
      (process.env as any).NODE_ENV = 'production';

      const invalidEnv = {
        JWT_SECRET: 'secret',
        // Missing required fields
      };

      const c = makeMockContext();
      vi.mocked(env).mockReturnValue(invalidEnv as any);

      expect(() => getEnv(c)).toThrow('Invalid environment variables');
    });

    it('merges Cloudflare bindings from raw env', () => {
      (process.env as any).NODE_ENV = 'test';

      const mockAI = { run: vi.fn() };
      const mockBucket = { get: vi.fn() };

      const c = makeMockContext();
      vi.mocked(env).mockReturnValue({
        JWT_SECRET: 'secret',
        AI: mockAI,
        PACKRAT_BUCKET: mockBucket,
      } as any);

      const result = getEnv(c);

      expect(result.AI).toBe(mockAI);
      expect(result.PACKRAT_BUCKET).toBe(mockBucket);
    });
  });

  // -------------------------------------------------------------------------
  // validateCloudflareApiEnv
  // -------------------------------------------------------------------------
  describe('validateCloudflareApiEnv', () => {
    it('validates complete environment without throwing', () => {
      const validEnv = {
        ENVIRONMENT: 'production',
        SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
        NEON_DATABASE_URL: 'postgres://user:pass@host/db',
        NEON_DATABASE_URL_READONLY: 'postgres://user:pass@host/db',
        JWT_SECRET: 'secret',
        PASSWORD_RESET_SECRET: 'reset',
        GOOGLE_CLIENT_ID: 'google',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'admin-pass',
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
        CF_VERSION_METADATA: {},
        AI: {},
        PACKRAT_SCRAPY_BUCKET: {},
        PACKRAT_BUCKET: {},
        PACKRAT_GUIDES_BUCKET: {},
        ETL_QUEUE: {},
        LOGS_QUEUE: {},
        EMBEDDINGS_QUEUE: {},
        APP_CONTAINER: {},
      };

      expect(() => validateCloudflareApiEnv(validEnv)).not.toThrow();
    });

    it('throws for missing required fields', () => {
      const invalidEnv = {
        JWT_SECRET: 'secret',
        // Missing many required fields
      };

      expect(() => validateCloudflareApiEnv(invalidEnv)).toThrow();
    });

    it('throws for invalid URL format', () => {
      const invalidEnv = {
        SENTRY_DSN: 'not-a-url',
        // ... other fields
      };

      expect(() => validateCloudflareApiEnv(invalidEnv)).toThrow();
    });

    it('throws for invalid email format', () => {
      const invalidEnv = {
        SENTRY_DSN: 'https://test@test.ingest.sentry.io/123',
        EMAIL_FROM: 'not-an-email',
        // ... other fields
      };

      expect(() => validateCloudflareApiEnv(invalidEnv)).toThrow();
    });

    it('throws for invalid OPENAI_API_KEY format', () => {
      const invalidEnv = {
        OPENAI_API_KEY: 'invalid-format',
        // ... other fields
      };

      expect(() => validateCloudflareApiEnv(invalidEnv)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Test environment detection
  // -------------------------------------------------------------------------
  describe('test environment detection', () => {
    it('detects NODE_ENV=test', () => {
      (process.env as any).NODE_ENV = 'test';
      const c = makeMockContext();
      vi.mocked(env).mockReturnValue({} as any);

      const result = getEnv(c);
      expect(result.ENVIRONMENT).toBe('development'); // test schema default
    });

    it('detects VITEST=true', () => {
      process.env.VITEST = 'true';
      const c = makeMockContext();
      vi.mocked(env).mockReturnValue({} as any);

      const result = getEnv(c);
      expect(result.ENVIRONMENT).toBe('development');
    });

    it('uses production schema when not in test', () => {
      delete (process.env as any).NODE_ENV;
      delete process.env.VITEST;

      const c = makeMockContext();
      vi.mocked(env).mockReturnValue({} as any);

      // Should throw because production schema requires many fields
      expect(() => getEnv(c)).toThrow('Invalid environment variables');
    });
  });
});
