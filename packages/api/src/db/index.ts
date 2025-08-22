import { neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import type { Context } from 'hono';

// Check if we're in a test environment
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// Create SQL client with appropriate driver based on environment
export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = getEnv(c);
  
  // Use node-postgres for test environment with localhost connections
  if (isTestEnvironment && NEON_DATABASE_URL.includes('localhost')) {
    const client = new Client(NEON_DATABASE_URL);
    client.connect().catch(console.error);
    return drizzleNode(client, { schema });
  }
  
  // Use Neon for production
  const sql = neon(NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};

// Create a read-only SQL client
export const createReadOnlyDb = (c: Context) => {
  const { NEON_DATABASE_URL_READONLY } = getEnv(c);
  
  // Use node-postgres for test environment with localhost connections
  if (isTestEnvironment && NEON_DATABASE_URL_READONLY.includes('localhost')) {
    const client = new Client(NEON_DATABASE_URL_READONLY);
    client.connect().catch(console.error);
    return drizzleNode(client, { schema });
  }
  
  // Use Neon for production
  const sql = neon(NEON_DATABASE_URL_READONLY);
  return drizzle(sql, { schema });
};

// Create SQL client for queue workers
export const createDbClient = (env: Env) => {
  // Use node-postgres for test environment with localhost connections
  if (isTestEnvironment && env.NEON_DATABASE_URL.includes('localhost')) {
    const client = new Client(env.NEON_DATABASE_URL);
    client.connect().catch(console.error);
    return drizzleNode(client, { schema });
  }
  
  // Use Neon for production
  const sql = neon(env.NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};
