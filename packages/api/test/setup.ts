// Setup test environment variables before any imports
// This must be done before importing any modules that use these env vars
const testEnv = {
  // Environment & Deployment
  ENVIRONMENT: 'development',
  SENTRY_DSN: 'https://test@test.ingest.sentry.io/test',
  CF_VERSION_METADATA_ID: 'test-version-id',

  // Database - Using PostgreSQL Docker container for tests
  NEON_DATABASE_URL: 'postgres://test_user:test_password@localhost:5433/packrat_test',
  NEON_DATABASE_URL_READONLY: 'postgres://test_user:test_password@localhost:5433/packrat_test',

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
  AI_GATEWAY_URL: 'https://ai.test.local',
  AI_EMBEDDINGS_URL: 'https://embeddings.test.local',

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

  // Cloudflare bindings (for vitest-pool-workers)
  ETL_QUEUE: 'queue',
  LOGS_QUEUE: 'logs-queue',
  EMBEDDINGS_QUEUE: 'embeddings-queue',
};

// Apply test environment
Object.assign(process.env, testEnv);

// Mock hono/adapter to return process.env for getEnv() to work correctly
vi.mock('hono/adapter', async () => {
  const actual = await vi.importActual<typeof import('hono/adapter')>('hono/adapter');
  return { ...actual, env: () => process.env };
});

// Mock AI service to prevent "this.env.AI.autorag" errors in tests
vi.mock('@packrat/api/services/aiService', async () => {
  const actual = await vi.importActual<typeof import('@packrat/api/services/aiService')>(
    '@packrat/api/services/aiService',
  );
  return {
    ...actual,
    AIService: vi.fn().mockImplementation(() => ({
      searchPackratOutdoorGuidesRAG: vi.fn().mockResolvedValue({
        data: [],
        search_query: '',
        has_more: false,
        next_page: null,
        object: 'vector_store.search_results.page',
      }),
      perplexitySearch: vi.fn().mockResolvedValue({ results: [] }),
    })),
  };
});

// Mock the getEnv function to return test environment
vi.mock('@packrat/api/utils/env-validation', async () => {
  const actual = await vi.importActual<typeof import('@packrat/api/utils/env-validation')>(
    '@packrat/api/utils/env-validation',
  );
  return {
    ...actual,
    getEnv: vi.fn(() => ({
      ENVIRONMENT: 'development',
      SENTRY_DSN: 'https://test@test.ingest.sentry.io/test',
      JWT_SECRET: 'secret',
      PASSWORD_RESET_SECRET: 'secret',
      GOOGLE_CLIENT_ID: 'test-client-id',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin-password',
      PACKRAT_API_KEY: 'test-api-key',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'key',
      EMAIL_FROM: 'test@example.com',
      OPENAI_API_KEY: 'sk-test-key',
      AI_PROVIDER: 'openai',
      PERPLEXITY_API_KEY: 'pplx-test-key',
      AI_GATEWAY_URL: 'https://ai.test.local',
      AI_EMBEDDINGS_URL: 'https://embeddings.test.local',
      OPENWEATHER_KEY: 'test-weather-key',
      WEATHER_API_KEY: 'test-weather-key',
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway-id',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
      PACKRAT_BUCKET_R2_BUCKET_NAME: 'test-bucket',
      PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'test-guides-bucket',
      PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'test-scrapy-bucket',
      PACKRAT_GUIDES_RAG_NAME: 'test-rag',
      PACKRAT_GUIDES_BASE_URL: 'https://guides.test.com',
      CF_VERSION_METADATA: { id: 'test-version-id' },
      NEON_DATABASE_URL: 'postgres://test_user:test_password@localhost:5433/packrat_test',
      NEON_DATABASE_URL_READONLY: 'postgres://test_user:test_password@localhost:5433/packrat_test',
      AI: undefined,
    })),
  };
});

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import * as schema from '../src/db/schema';

let testClient: Client;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module to use our test database (node-postgres version)
vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => testDb),
  createReadOnlyDb: vi.fn(() => testDb),
  createDbClient: vi.fn(() => testDb),
}));

// Setup PostgreSQL connection for tests
beforeAll(async () => {
  console.log('🔧 Setting up test database connection...');

  // Create direct PostgreSQL client connection for manual database operations
  testClient = new Client({
    host: 'localhost',
    port: 5433,
    database: 'packrat_test',
    user: 'test_user',
    password: 'test_password',
  });

  try {
    await testClient.connect();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup requires any for drizzle types
    testDb = drizzle(testClient, { schema }) as any;
    console.log('✅ Test database connected successfully');

    // Run migrations using direct PostgreSQL client
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const migrationsDir = path.join(process.cwd(), 'drizzle');

    try {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

      for (const file of sqlFiles) {
        const migrationSql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
        await testClient.query(migrationSql);
      }

      console.log('✅ Test database migrations completed');
    } catch (error) {
      console.error('❌ Failed to run database migrations:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    console.log('This is expected in CI where PostgreSQL service should be available');
    throw error;
  }
});

// Clean up database after each test to ensure isolation
beforeEach(async () => {
  if (!testClient) return;

  // Truncate all tables except migrations and drizzle metadata using PostgreSQL client
  const tablesToTruncate = [
    'users',
    'packs',
    'pack_items',
    'pack_templates',
    'pack_template_items',
    'user_items',
    'catalog_items',
    'weather_cache',
    'password_reset_codes',
    'verification_codes',
    'weight_history',
  ];

  for (const tableName of tablesToTruncate) {
    try {
      await testClient.query(`TRUNCATE TABLE ${tableName} CASCADE`);
    } catch (_error) {
      // Ignore errors for non-existent tables
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test database connection...');

  try {
    // Close PostgreSQL client connection
    if (testClient) {
      await testClient.end();
    }
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Failed to cleanup test database connection:', error);
  }
});
