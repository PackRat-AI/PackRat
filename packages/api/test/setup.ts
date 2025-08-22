// Environment & Deployment
process.env.ENVIRONMENT = 'development';
process.env.SENTRY_DSN = 'https://test@test.ingest.sentry.io/test';

// Database - Using in-memory PGlite for tests
process.env.NEON_DATABASE_URL = 'pglite://memory';
process.env.NEON_DATABASE_URL_READONLY = 'pglite://memory';

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

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import * as schema from '../src/db/schema';

let pglite: PGlite;
let testDb: ReturnType<typeof drizzle>;

// Setup in-memory database before all tests
beforeAll(async () => {
  // Create in-memory PGlite instance
  pglite = new PGlite();
  testDb = drizzle(pglite, { schema });

  // Run migrations by executing SQL directly
  try {
    // Read and execute migration files
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const migrationsDir = path.join(process.cwd(), 'drizzle');

    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
      await pglite.exec(sql);
    }

    console.log('✅ Test database setup complete');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
});

// Clean up database after each test to ensure isolation
beforeEach(async () => {
  // Truncate all tables except migrations
  const tables = Object.keys(schema);
  for (const tableName of tables) {
    try {
      await pglite.exec(`TRUNCATE TABLE ${tableName} CASCADE`);
    } catch (_error) {
      // Ignore errors for non-existent tables
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (pglite) {
    await pglite.close();
  }
});

// Mock the database module to use our test database
vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => testDb),
  createReadOnlyDb: vi.fn(() => testDb),
  createDbClient: vi.fn(() => testDb),
}));

// Mock neon module to work with PGlite
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => (sql: string, params?: unknown[]) => pglite.query(sql, params)),
}));

// Mock drizzle-orm/neon-http to use PGlite
vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => testDb),
}));

vi.mock('hono/adapter', async () => {
  const actual = await vi.importActual<typeof import('hono/adapter')>('hono/adapter');
  return { ...actual, env: () => process.env };
});
