import { Pool } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { Context } from 'hono';
import { env as honoEnv } from 'hono/adapter';

// Create SQL client with Neon for Hono contexts
export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = honoEnv<Env>(c);
  const pool = new Pool({ connectionString: NEON_DATABASE_URL });
  return drizzle(pool, { schema });
};

// Create SQL client with Neon for queue workers
export const createDbClient = (env: Env) => {
  const pool = new Pool({ connectionString: env.NEON_DATABASE_URL });
  return drizzle(pool, { schema });
};
