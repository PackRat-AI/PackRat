import { drizzle } from 'drizzle-orm/node-postgres';
import type { Client } from 'pg';
import * as schema from '../../src/db/schema';

// Get the test database instance from global setup
let testDb: ReturnType<typeof drizzle> | null = null;

export const setTestDb = (db: ReturnType<typeof drizzle>) => {
  testDb = db;
};

export const getTestDb = () => {
  if (!testDb) {
    throw new Error('Test database not initialized. Make sure test setup has run.');
  }
  return testDb;
};

// Mock implementations that use the test database
export const createDb = () => getTestDb();
export const createReadOnlyDb = () => getTestDb();
export const createDbClient = () => getTestDb();