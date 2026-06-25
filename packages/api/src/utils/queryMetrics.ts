import { AsyncLocalStorage } from 'node:async_hooks';
import { createMetricsDb } from '@packrat/api/db/metricsDb';
import { getEnv } from '@packrat/api/utils/env-validation';
import { requestQueryMetricsD1 } from '@packrat/db/d1Schema';
import type { CapturedQuery } from '@packrat/db/schema';
import { safeJsonStringify } from '@packrat/utils';

export interface QueryMetricsStore {
  route: string;
  method: string;
  startTimeMs: number;
  userId?: string;
  queries: CapturedQuery[];
  totalDurationMs: number;
  estimatedEgressBytes: number;
  currentQueryTag?: string;
}

export const queryMetricsAls = new AsyncLocalStorage<QueryMetricsStore>();

const SKIP_ROUTES = new Set(['/', '/health', '/openapi', '/openapi.json']);

export function createQueryMetricsStore({
  route,
  method,
}: {
  route: string;
  method: string;
}): QueryMetricsStore {
  return {
    route,
    method,
    startTimeMs: Date.now(),
    queries: [],
    totalDurationMs: 0,
    estimatedEgressBytes: 0,
  };
}

export function initQueryMetricsStore(request: Request): QueryMetricsStore {
  const url = new URL(request.url);
  return createQueryMetricsStore({ route: normalizeRoute(url.pathname), method: request.method });
}

export function setQueryMetricsUser(userId: string): void {
  const store = queryMetricsAls.getStore();
  if (store) store.userId = userId;
}

// Label the next query (or queries) with a human-readable tag visible in analytics.
// Call right before issuing a query. The tag persists for the rest of the request
// unless overwritten — safe because ALS is per-request.
export function setQueryTag(tag: string): void {
  const store = queryMetricsAls.getStore();
  if (store) store.currentQueryTag = tag;
}

const ROUTE_UUID_RE = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ROUTE_NUMERIC_ID_RE = /\/\d{5,}/g;
const ROUTE_TOKEN_RE = /\/[a-zA-Z0-9_-]{32,}/g;

function normalizeRoute(pathname: string): string {
  return pathname
    .replace(ROUTE_UUID_RE, '/:id')
    .replace(ROUTE_NUMERIC_ID_RE, '/:id')
    .replace(ROUTE_TOKEN_RE, '/:token');
}

// FNV-1a 32-bit over the full query string — better distribution than a
// truncated polynomial hash and avoids collisions for queries that share
// a common prefix.
export function hashQuery(query: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < query.length; i++) {
    h ^= query.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function estimateResultBytes(rows: unknown): number {
  try {
    return new TextEncoder().encode(safeJsonStringify(rows)).byteLength;
  } catch {
    return 0;
  }
}

export function recordQueryExecution(entry: CapturedQuery): void {
  const store = queryMetricsAls.getStore();
  if (store) store.queries.push(entry);
}

export async function flushQueryMetrics({
  store,
  statusCode,
}: {
  store: QueryMetricsStore;
  statusCode?: number;
}): Promise<void> {
  if (SKIP_ROUTES.has(store.route)) return;
  if (store.queries.length === 0 && store.totalDurationMs < 5) return;

  try {
    const env = getEnv();
    if (!env.METRICS_DB) return;
    const db = createMetricsDb(env.METRICS_DB);
    await db.insert(requestQueryMetricsD1).values({
      id: crypto.randomUUID(),
      capturedAt: Date.now(),
      route: store.route,
      method: store.method,
      statusCode: statusCode ?? null,
      totalDurationMs: store.totalDurationMs,
      estimatedEgressBytes: store.estimatedEgressBytes,
      queryCount: store.queries.length,
      userId: store.userId ?? null,
      queries: safeJsonStringify(store.queries),
    });
  } catch {
    // Monitoring must never crash the app — swallow silently
  }
}
