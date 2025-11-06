// Environment & Deployment
process.env.ENVIRONMENT = 'development';
process.env.SENTRY_DSN = 'https://test@test.ingest.sentry.io/test';
process.env.CF_VERSION_METADATA = JSON.stringify({ id: 'test-version' });

// Database - Using PostgreSQL Docker container for tests
process.env.NEON_DATABASE_URL = 'postgres://test_user:test_password@localhost:5433/packrat_test';
process.env.NEON_DATABASE_URL_READONLY =
  'postgres://test_user:test_password@localhost:5433/packrat_test';

// Authentication & Security
process.env.JWT_SECRET = 'secret';
process.env.PASSWORD_RESET_SECRET = 'secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-password';
process.env.PACKRAT_API_KEY = 'test-api-key';

// Email Configuration
process.env.EMAIL_PROVIDER = 'resend';
process.env.RESEND_API_KEY = 'key';
process.env.EMAIL_FROM = 'test@example.com';

// AI & External APIs
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.AI_PROVIDER = 'openai';
process.env.PERPLEXITY_API_KEY = 'pplx-test-key';

// Weather Services
process.env.OPENWEATHER_KEY = 'test-weather-key';
process.env.WEATHER_API_KEY = 'test-weather-key';

// Cloudflare R2 Storage (config values)
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
process.env.CLOUDFLARE_AI_GATEWAY_ID = 'test-gateway-id';
process.env.R2_ACCESS_KEY_ID = 'test-access-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.PACKRAT_BUCKET_R2_BUCKET_NAME = 'test-bucket';
process.env.PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME = 'test-guides-bucket';
process.env.PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME = 'test-scrapy-bucket';

// Content & Guides
process.env.PACKRAT_GUIDES_RAG_NAME = 'test-rag';
process.env.PACKRAT_GUIDES_BASE_URL = 'https://guides.test.com';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import * as schema from '../src/db/schema';

let testClient: Client;
let testDb: ReturnType<typeof drizzle>;
let isConnected = false;

vi.mock('hono/adapter', async () => {
  const actual = await vi.importActual<typeof import('hono/adapter')>('hono/adapter');
  return { ...actual, env: () => process.env };
});

// Mock google-auth-library to avoid node:child_process issues in Workers environment
vi.mock('google-auth-library', () => ({
  OAuth2Client: class MockOAuth2Client {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          sub: 'mock-google-id',
          email: 'test@gmail.com',
          name: 'Test User',
          email_verified: true,
        }),
      };
    }
  },
}));

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
    testDb = drizzle(testClient, { schema }) as any;
    isConnected = true;
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up database after each test to ensure isolation
beforeEach(async () => {
  if (!testClient) return;

  // Truncate all tables in a single transaction for better performance
  // Using CASCADE to handle foreign key constraints
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

  try {
    // Run all truncates in a single statement for speed
    const truncateQuery = tablesToTruncate
      .map(table => `TRUNCATE TABLE "${table}" CASCADE`)
      .join('; ');
    await testClient.query(truncateQuery);
  } catch (_error) {
    // Ignore errors - tables might not exist yet
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test database connection...');

  try {
    // Close PostgreSQL client connection only if it was successfully connected
    if (isConnected && testClient) {
      await testClient.end();
    }
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Failed to cleanup test database connection:', error);
  }
});
