import { Pool as NeonPool, neon, neonConfig } from '@neondatabase/serverless';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import {
  estimateResultBytes,
  hashQuery,
  queryMetricsAls,
  recordQueryExecution,
  setQueryTag,
} from '@packrat/api/utils/queryMetrics';
import * as schema from '@packrat/db/schema';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const runtimeEnv = () =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

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

const getPgPoolMax = () => {
  const parsed = Number(runtimeEnv().PACKRAT_PG_POOL_MAX);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
};

const shouldUseNeonWsProxy = (url: string) => {
  if (runtimeEnv().PACKRAT_USE_NEON_WSPROXY === 'true') return true;

  try {
    const u = new URL(url);
    return u.hostname === 'localhost' && u.port === '5432';
  } catch {
    return false;
  }
};

// Wraps a Drizzle db instance to add a chainable .tag() method:
//   db.tag('service.method').select().from(table)
// Uses Proxy since $extend is not available in drizzle-orm 0.45.x.
type WithTag<T> = T & { tag(label: string): WithTag<T> };

function withTagging<T extends object>(db: T): WithTag<T> {
  const proxy: WithTag<T> = new Proxy(db, {
    get(target, prop) {
      if (prop === 'tag') {
        return (label: string) => {
          setQueryTag(label);
          return proxy;
        };
      }
      const val = Reflect.get(target, prop, target);
      return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(target) : val;
    },
  }) as WithTag<T>;
  return proxy;
}

// ---------------------------------------------------------------------------
// Driver instrumentation helpers
//
// Each helper wraps the underlying client's query method so that after every
// execution we record: duration (ms), result size (bytes), and the current
// query tag (set by callers via withQueryTag() in queryMetrics.ts).
// ---------------------------------------------------------------------------

// For neon-http: patches fn.query(sql, params?, options?) in-place.
// Drizzle's neon-http session resolves clientQuery = client.query ?? client,
// so it always goes through .query() when present.
function instrumentNeonFn(fn: ReturnType<typeof neon>): ReturnType<typeof neon> {
  const orig = fn.query.bind(fn);
  fn.query = (async (...args: Parameters<typeof orig>) => {
    const sql = args[0] as string;
    const start = Date.now();
    const result = await orig(...args);
    const hash = hashQuery(sql);
    recordQueryExecution({
      hash,
      preview: sql.slice(0, 120),
      callSite: queryMetricsAls.getStore()?.currentQueryTag,
      durationMs: Date.now() - start,
      resultBytes: estimateResultBytes((result as { rows?: unknown }).rows),
    });
    return result;
  }) as typeof fn.query;
  return fn;
}

// For NeonPool / pg.Pool: patches pool.query({ text, ... }, params?) in-place.
// Drizzle's neon-serverless session always passes a QueryConfig object as the
// first arg (never a plain string), so we extract .text for metrics only.
function instrumentPool<T extends { query: (...args: unknown[]) => Promise<unknown> }>(pool: T): T {
  const orig = pool.query.bind(pool);
  pool.query = (async (...args: Parameters<typeof orig>) => {
    const first = args[0];
    const sql = typeof first === 'string' ? first : ((first as { text?: string })?.text ?? '');
    const start = Date.now();
    const result = await orig(...args);
    const hash = hashQuery(sql);
    recordQueryExecution({
      hash,
      preview: sql.slice(0, 120),
      callSite: queryMetricsAls.getStore()?.currentQueryTag,
      durationMs: Date.now() - start,
      resultBytes: estimateResultBytes((result as { rows?: unknown })?.rows),
    });
    return result;
  }) as T['query'];
  return pool;
}

export const createConnection = ({ url, useNeonHttp }: { url: string; useNeonHttp?: boolean }) => {
  if (isStandardPostgresUrl(url)) {
    if (shouldUseNeonWsProxy(url)) {
      neonConfig.wsProxy = () =>
        runtimeEnv().NEON_WS_PROXY ?? 'localhost:5434/v1?address=postgres-test:5432';
      neonConfig.useSecureWebSocket = false;
      neonConfig.pipelineConnect = false;
      neonConfig.pipelineTLS = false;
      const neonPool = instrumentPool(new NeonPool({ connectionString: url }));
      return withTagging(drizzleServerless(neonPool, { schema }));
    }

    let pool = pgPools.get(url);
    if (!pool) {
      const newPool = new Pool({
        connectionString: url,
        max: getPgPoolMax(),
        // idleTimeoutMillis: 0 prevents pg.Pool from calling setTimeout().unref(),
        // which is not supported in the Cloudflare Workers runtime (miniflare).
        idleTimeoutMillis: 0,
        connectionTimeoutMillis: 10000,
      });
      newPool.on('error', () => {
        pgPools.delete(url);
      });
      pgPools.set(url, newPool);
      pool = newPool;
    }
    instrumentPool(pool);
    return withTagging(drizzlePg(pool, { schema }));
  }
  if (useNeonHttp) {
    const fn = instrumentNeonFn(neon(url));
    return withTagging(drizzle(fn, { schema }));
  }
  const neonPool = instrumentPool(new NeonPool({ connectionString: url }));
  return withTagging(drizzleServerless(neonPool, { schema }));
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
