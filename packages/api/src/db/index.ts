import { neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { Context } from 'hono';
import { Client } from 'pg';

// Check if we're in test environment
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.ENVIRONMENT === 'development';

// Test database connection for tests
let testDbClient: Client | null = null;
let testDb: ReturnType<typeof drizzlePg> | null = null;

// Initialize test database connection synchronously if possible
if (isTestEnv) {
  try {
    testDbClient = new Client({
      host: 'localhost',
      port: 5433,
      database: 'packrat_test',
      user: 'test_user',
      password: 'test_password',
    });
    // We'll connect this later in the setup
  } catch (error) {
    console.warn('Failed to create test database client:', error);
    testDbClient = null;
  }
}

// Helper to get test database connection
const getTestDb = () => {
  console.log('🔍 getTestDb called');
  console.log('🔍 isTestEnv:', isTestEnv);
  console.log('🔍 testDb:', testDb ? 'exists' : 'null');
  if (isTestEnv && testDb) {
    return testDb;
  }
  return null;
};

// Export function to set test database for tests
export const setTestDatabase = (db: ReturnType<typeof drizzlePg>) => {
  testDb = db;
};

// Create SQL client with Neon for Hono contexts
export const createDb = (c: Context) => {
  // In test environment, try to use PostgreSQL first
  const testDatabase = getTestDb();
  if (testDatabase) {
    console.log('✅ Using test database (PostgreSQL)');
    return testDatabase;
  }
  
  console.log('🔄 Using Neon database');
  const { NEON_DATABASE_URL } = getEnv(c);
  console.log('🔗 Neon URL:', NEON_DATABASE_URL);
  const sql = neon(NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};

// Create a read-only SQL client with Neon for Hono contexts
export const createReadOnlyDb = (c: Context) => {
  // In test environment, try to use PostgreSQL first
  const testDatabase = getTestDb();
  if (testDatabase) {
    return testDatabase;
  }
  
  const { NEON_DATABASE_URL_READONLY } = getEnv(c);
  const sql = neon(NEON_DATABASE_URL_READONLY);
  return drizzle(sql, { schema });
};

// Create SQL client with Neon for queue workers
export const createDbClient = (env: Env) => {
  // In test environment, try to use PostgreSQL first
  const testDatabase = getTestDb();
  if (testDatabase) {
    return testDatabase;
  }
  
  const sql = neon(env.NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};
