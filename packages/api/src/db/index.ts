import { Pool as NeonPool, neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Check if we're using a standard PostgreSQL URL (for tests) vs Neon URL
const isStandardPostgresUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    return u.protocol === 'postgres:' && !isNeonTech && !isNeonCom;
  } catch {
    return false;
  }
};

// Create database connection based on URL type
const createConnection = (url: string, useNeonHttp?: boolean) => {
  if (isStandardPostgresUrl(url)) {
    const pool = new Pool({ connectionString: url });
    return drizzlePg(pool, { schema });
  }
  if (useNeonHttp) {
    const sql = neon(url);
    return drizzle(sql, { schema });
  }
  const neonPool = new NeonPool({ connectionString: url });
  return drizzleServerless(neonPool, { schema });
};

type ContextLike = { env?: Record<string, unknown> } | Record<string, unknown> | undefined;

/**
 * Create a read/write SQL client.
 *
 * Accepts:
 *  - nothing (Elysia / isolate-level env from cache)
 *  - a Hono Context (legacy routes)
 *  - an Elysia context object with `.env`
 *  - a validated `ValidatedEnv`
 */
export const createDb = (input?: ContextLike) => {
  const { NEON_DATABASE_URL } = getEnv(input);
  return createConnection(NEON_DATABASE_URL);
};

/**
 * Create a read-only SQL client.
 */
export const createReadOnlyDb = (input?: ContextLike) => {
  const { NEON_DATABASE_URL_READONLY } = getEnv(input);
  return createConnection(NEON_DATABASE_URL_READONLY);
};

/**
 * Create SQL client tuned for queue workers (HTTP driver, no pool).
 */
export const createDbClient = (env: ValidatedEnv) => {
  return createConnection(env.NEON_DATABASE_URL, true);
};
