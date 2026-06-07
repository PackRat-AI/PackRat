import { AsyncLocalStorage } from 'node:async_hooks';
import { createMetricsDb } from '@packrat/api/db/metricsDb';
import { getEnv } from '@packrat/api/utils/env-validation';
import { requestQueryMetricsD1 } from '@packrat/db/d1Schema';
import type { CapturedQuery } from '@packrat/db/schema';

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

export function createQueryMetricsStore(route: string, method: string): QueryMetricsStore {
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
  return createQueryMetricsStore(normalizeRoute(url.pathname), request.method);
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

// Tag all DB queries issued within fn() with the given label.
// Restores the previous tag on exit — safe for nested calls.
export async function withQueryTag<T>(tag: string, fn: () => Promise<T>): Promise<T> {
  const store = queryMetricsAls.getStore();
  if (!store) return fn();
  const prev = store.currentQueryTag;
  store.currentQueryTag = tag;
  try {
    return await fn();
  } finally {
    store.currentQueryTag = prev;
  }
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

export function hashQuery(query: string): string {
  let h = 0;
  const limit = Math.min(query.length, 500);
  for (let i = 0; i < limit; i++) {
    h = (Math.imul(31, h) + query.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function estimateResultBytes(rows: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(rows)).byteLength;
  } catch {
    return 0;
  }
}

export function recordQueryExecution(entry: CapturedQuery): void {
  const store = queryMetricsAls.getStore();
  if (store) store.queries.push(entry);
}

export async function flushQueryMetrics(
  store: QueryMetricsStore,
  statusCode?: number,
): Promise<void> {
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
      queries: JSON.stringify(store.queries),
    });
  } catch {
    // Monitoring must never crash the app — swallow silently
  }
}
