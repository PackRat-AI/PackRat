import { Pool as NeonPool, neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { Context } from 'hono';
import { Pool } from 'pg';

// Cache for database connections
const connectionCache = new Map<string, ReturnType<typeof drizzlePg>>();

// Check if we're using a standard PostgreSQL URL (for tests) vs Neon URL
const isStandardPostgresUrl = (url: string) => {
  // Parse and check the hostname to robustly exclude Neon domains
  try {
    const u = new URL(url);
    // Only allow if NOT neon.tech and NOT neon.com, and NOT their subdomains
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    return u.protocol === 'postgres:' && !isNeonTech && !isNeonCom;
  } catch {
    // Any parsing error: treat as NOT standard Postgres
    return false;
  }
};

// Create database connection based on URL type
const createConnection = (url: string, useNeonHttp?: boolean) => {
  // Check cache first
  const cacheKey = `${url}:${useNeonHttp}`;
  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey)!;
  }

  let connection;
  if (isStandardPostgresUrl(url)) {
    // Use node-postgres for standard PostgreSQL (tests)
    const pool = new Pool({ connectionString: url });
    connection = drizzlePg(pool, { schema });
  } else {
    // Use Neon for production
    if (useNeonHttp) {
      const sql = neon(url);
      connection = drizzle(sql, { schema }) as any;
    } else {
      const neonPool = new NeonPool({ connectionString: url });
      connection = drizzleServerless(neonPool, { schema }) as any;
    }
  }

  // Cache the connection
  connectionCache.set(cacheKey, connection as any);
  return connection;
};

// Create SQL client with appropriate driver for Hono contexts
export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = getEnv(c);
  return createConnection(NEON_DATABASE_URL);
};

// Create a read-only SQL client with appropriate driver for Hono contexts
export const createReadOnlyDb = (c: Context) => {
  const { NEON_DATABASE_URL_READONLY } = getEnv(c);
  return createConnection(NEON_DATABASE_URL_READONLY);
};

// Create SQL client with appropriate driver for queue workers
export const createDbClient = (env: Env) => {
  return createConnection(env.NEON_DATABASE_URL, true);
};
