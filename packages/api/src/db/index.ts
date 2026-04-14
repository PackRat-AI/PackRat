import { Pool as NeonPool, neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import type { Context } from 'hono';

const createServerlessDb = (url: string) =>
  drizzleServerless(new NeonPool({ connectionString: url }), { schema });

const createHttpDb = (url: string) => drizzleHttp(neon(url), { schema });

export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = getEnv(c);
  return createServerlessDb(NEON_DATABASE_URL);
};

export const createReadOnlyDb = (c: Context) => {
  const { NEON_DATABASE_URL_READONLY } = getEnv(c);
  return createServerlessDb(NEON_DATABASE_URL_READONLY);
};

export const createDbClient = (env: Env) => createHttpDb(env.NEON_DATABASE_URL);
