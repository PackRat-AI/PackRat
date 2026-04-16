import { Pool as NeonPool, neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import type { Context } from 'hono';

const createConnection = (url: string, useNeonHttp?: boolean) => {
  if (useNeonHttp) {
    return drizzle(neon(url), { schema });
  }
  return drizzleServerless(new NeonPool({ connectionString: url }), { schema });
};

export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = getEnv(c);
  return createConnection(NEON_DATABASE_URL);
};

export const createReadOnlyDb = (c: Context) => {
  const { NEON_DATABASE_URL_READONLY } = getEnv(c);
  return createConnection(NEON_DATABASE_URL_READONLY);
};

export const createDbClient = (env: Env) => {
  return createConnection(env.NEON_DATABASE_URL, true);
};
