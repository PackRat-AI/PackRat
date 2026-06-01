import { Pool as NeonPool, neon } from '@neondatabase/serverless';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import * as schema from '@packrat/db/schema';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const isStandardPostgresUrl = (url: string) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isNeonTech = host === 'neon.tech' || host.endsWith('.neon.tech');
    const isNeonCom = host === 'neon.com' || host.endsWith('.neon.com');
    // `db.localtest.me` is the host the local Neon HTTP proxy uses (see
    // packages/api/docker-compose.test.yml). The URL looks like raw Postgres but
    // the proxy speaks Neon's HTTP/WS wire format, so route it through the neon
    // driver — the same code path as prod, with no node-postgres TCP sockets
    // (which workerd silently drops between requests).
    const isLocalNeonProxy = host === 'db.localtest.me';
    return (
      (u.protocol === 'postgres:' || u.protocol === 'postgresql:') &&
      !isNeonTech &&
      !isNeonCom &&
      !isLocalNeonProxy
    );
  } catch {
    return false;
  }
};

const pgPools = new Map<string, Pool>();

export const createConnection = ({ url, useNeonHttp }: { url: string; useNeonHttp?: boolean }) => {
  if (isStandardPostgresUrl(url)) {
    let pool = pgPools.get(url);
    if (!pool) {
      const newPool = new Pool({
        connectionString: url,
        max: 5,
        // idleTimeoutMillis: 0 prevents pg.Pool from calling setTimeout().unref(),
        // which is not supported in the Cloudflare Workers runtime (miniflare).
        idleTimeoutMillis: 0,
        connectionTimeoutMillis: 10000,
      });
      newPool.on('error', () => {
        pgPools.delete(url);
        newPool.end().catch(() => {});
      });
      pgPools.set(url, newPool);
      pool = newPool;
    }
    return drizzlePg(pool, { schema });
  }
  if (useNeonHttp) {
    const sql = neon(url);
    return drizzle(sql, { schema });
  }
  const neonPool = new NeonPool({ connectionString: url });
  return drizzleServerless(neonPool, { schema });
};

/**
 * Create a read/write SQL client using the validated isolate env (primed via
 * `setWorkerEnv` at the worker entry point).
 */
export const createDb = () => {
  const { NEON_DATABASE_URL } = getEnv();
  return createConnection({ url: NEON_DATABASE_URL });
};

/**
 * Create a read-only SQL client.
 */
export const createReadOnlyDb = () => {
  const { NEON_DATABASE_URL_READONLY } = getEnv();
  return createConnection({ url: NEON_DATABASE_URL_READONLY });
};

/**
 * Create a client for the dedicated OSM/trail database.
 *
 * Reads OSM_DATABASE_URL — a separate Postgres instance from the main app DB.
 * For Cloudflare Workers + dedicated Postgres: set this to env.OSM_HYPERDRIVE.connectionString
 * (add a [[hyperdrive]] binding in wrangler.jsonc pointing at the Postgres instance).
 * The isStandardPostgresUrl check will route Hyperdrive URLs to pg.Pool automatically.
 */
export const createOsmDb = () => {
  const { OSM_DATABASE_URL } = getEnv();
  if (!OSM_DATABASE_URL) {
    throw new Error(
      'OSM_DATABASE_URL is not configured — trail features are disabled on this server',
    );
  }
  return createConnection({ url: OSM_DATABASE_URL });
};

/**
 * Create SQL client tuned for queue workers (HTTP driver, no pool).
 * Used from the queue handler which has direct access to the validated env.
 */
export const createDbClient = (env: ValidatedEnv) => {
  return createConnection({ url: env.NEON_DATABASE_URL, useNeonHttp: true });
};
