import { AsyncLocalStorage } from 'node:async_hooks';
import { createDb } from '@packrat/api/db';
import type { CapturedQuery } from '@packrat/db/schema';
import { requestQueryMetrics } from '@packrat/db/schema';

export interface QueryMetricsStore {
  route: string;
  method: string;
  startTimeMs: number;
  userId?: string;
  queries: CapturedQuery[];
  totalDurationMs: number;
  estimatedEgressBytes: number;
}

export const queryMetricsAls = new AsyncLocalStorage<QueryMetricsStore>();

const SKIP_ROUTES = new Set(['/', '/health', '/openapi', '/openapi.json']);

export function initQueryMetricsStore(request: Request): QueryMetricsStore {
  const url = new URL(request.url);
  return {
    route: normalizeRoute(url.pathname),
    method: request.method,
    startTimeMs: Date.now(),
    queries: [],
    totalDurationMs: 0,
    estimatedEgressBytes: 0,
  };
}

function normalizeRoute(pathname: string): string {
  return (
    pathname
      // UUIDs
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      // Long numeric IDs (5+ digits)
      .replace(/\/\d{5,}/g, '/:id')
      // Long opaque tokens (base64url, 32+ chars)
      .replace(/\/[a-zA-Z0-9_-]{32,}/g, '/:token')
  );
}

export function hashQuery(query: string): string {
  let h = 0;
  const limit = Math.min(query.length, 500);
  for (let i = 0; i < limit; i++) {
    h = (Math.imul(31, h) + query.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Drizzle Logger interface — called synchronously before each query executes.
// We only capture text + hash here; timing comes from the request-level wall clock.
export const queryMetricsLogger = {
  logQuery(query: string, _params: unknown[]): void {
    const store = queryMetricsAls.getStore();
    if (!store) return;
    store.queries.push({
      hash: hashQuery(query),
      preview: query.slice(0, 120),
    });
  },
};

export async function flushQueryMetrics(
  store: QueryMetricsStore,
  statusCode?: number,
): Promise<void> {
  if (SKIP_ROUTES.has(store.route)) return;
  if (store.queries.length === 0 && store.totalDurationMs < 5) return;

  try {
    const db = createDb();
    await db.insert(requestQueryMetrics).values({
      id: crypto.randomUUID(),
      route: store.route,
      method: store.method,
      statusCode: statusCode ?? null,
      totalDurationMs: store.totalDurationMs,
      estimatedEgressBytes: store.estimatedEgressBytes,
      queryCount: store.queries.length,
      userId: store.userId ?? null,
      queries: store.queries,
    });
  } catch {
    // Monitoring must never crash the app — swallow silently
  }
}
