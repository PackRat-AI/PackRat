import { neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { drizzle } from 'drizzle-orm/neon-http';

//To use local Postgres with Drizzle ORM
// import { drizzle } from 'drizzle-orm/node-postgres';
// import { Pool } from 'pg';

import type { Context } from 'hono';
import { env as honoEnv } from 'hono/adapter';

// Create SQL client with Neon for Hono contexts
export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = honoEnv<Env>(c);
  const sql = neon(NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};

// Create SQL client with Neon for queue workers
export const createDbClient = (env: Env) => {
  const sql = neon(env.NEON_DATABASE_URL);
  return drizzle(sql, { schema });
};

//To test in local Postgres 
// export const createDb = (c: Context) => {
//   const { NEON_DATABASE_URL } = honoEnv<Env>(c);
//   const pool = new Pool({ connectionString: NEON_DATABASE_URL });
//   return drizzle(pool, { schema });
// };

// export const createDbClient = (env: Env) => {
//   const pool = new Pool({ connectionString: env.NEON_DATABASE_URL });
//   return drizzle(pool, { schema });
// };