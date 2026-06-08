import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CapturedQuery } from './schema';

export type { CapturedQuery };

// Metrics table stored in Cloudflare D1 (edge-local SQLite).
// capturedAt is Unix milliseconds (SQLite has no native timestamptz).
// queries is a JSON-stringified CapturedQuery[].
export const requestQueryMetricsD1 = sqliteTable(
  'request_query_metrics',
  {
    id: text('id').primaryKey(),
    capturedAt: integer('captured_at').notNull(),
    route: text('route').notNull(),
    method: text('method').notNull(),
    statusCode: integer('status_code'),
    totalDurationMs: integer('total_duration_ms').notNull().default(0),
    estimatedEgressBytes: integer('estimated_egress_bytes').notNull().default(0),
    queryCount: integer('query_count').notNull().default(0),
    userId: text('user_id'),
    queries: text('queries').notNull().default('[]'),
  },
  (t) => [index('rqm_captured_at_route_idx').on(t.capturedAt, t.route)],
);

export type RequestQueryMetricD1 = InferSelectModel<typeof requestQueryMetricsD1>;
export type NewRequestQueryMetricD1 = InferInsertModel<typeof requestQueryMetricsD1>;
