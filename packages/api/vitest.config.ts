import { resolve } from 'node:path';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { defineConfig } from 'vitest/config';

const bindings = {
  // Environment & Deployment
  ENVIRONMENT: 'development',
  SENTRY_DSN: 'https://test@test.ingest.sentry.io/test',

  // Database
  NEON_DATABASE_URL: 'postgres://user:pass@localhost/db',
  NEON_DATABASE_URL_READONLY: 'postgres://user:pass@localhost/db',

  // Authentication & Security
  JWT_SECRET: 'secret',
  PASSWORD_RESET_SECRET: 'secret',
  GOOGLE_CLIENT_ID: 'test-client-id',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin-password',
  PACKRAT_API_KEY: 'test-api-key',

  // Email Configuration
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'key',
  EMAIL_FROM: 'test@example.com',

  // AI & External APIs
  OPENAI_API_KEY: 'sk-test-key',
  AI_PROVIDER: 'openai',
  PERPLEXITY_API_KEY: 'pplx-test-key',

  // Weather Services
  OPENWEATHER_KEY: 'test-weather-key',
  WEATHER_API_KEY: 'test-weather-key',

  // Cloudflare R2 Storage (config values)
  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway-id',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  PACKRAT_BUCKET_R2_BUCKET_NAME: 'test-bucket',
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'test-guides-bucket',
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'test-scrapy-bucket',

  // Content & Guides
  PACKRAT_GUIDES_RAG_NAME: 'test-rag',
  PACKRAT_GUIDES_BASE_URL: 'https://guides.test.com',

  // Cloudflare bindings
  ETL_QUEUE: 'queue',
  LOGS_QUEUE: 'logs-queue',
  EMBEDDINGS_QUEUE: 'embeddings-queue',
};

Object.assign(process.env, bindings);

export default defineWorkersConfig(
  defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    test: {
      setupFiles: ['./test/setup.ts'],
      pool: '@cloudflare/vitest-pool-workers',
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
        },
      },
    },
  }),
);
