import { neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle } from 'drizzle-orm/neon-http';
import type { Context } from 'hono';

// Create SQL client with Neon for Hono contexts
export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = getEnv(c);
  const sql = neon(NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};

// Create a read-only SQL client with Neon for Hono contexts
export const createReadOnlyDb = (c: Context) => {
  const { NEON_DATABASE_URL_READONLY } = getEnv(c);
  const sql = neon(NEON_DATABASE_URL_READONLY);
  return drizzle(sql, { schema });
};

// Create SQL client with Neon for queue workers
export const createDbClient = (env: Env) => {
  const sql = neon(env.NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};
