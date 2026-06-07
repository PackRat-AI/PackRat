import { createMetricsDb } from '@packrat/api/db/metricsDb';
import { getEnv } from '@packrat/api/utils/env-validation';
import { requestQueryMetricsD1 } from '@packrat/db/d1Schema';
import { avg, count, desc, gte, sql, sum } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { z } from 'zod';

function getMetricsDb() {
  const env = getEnv();
  return createMetricsDb(env.METRICS_DB);
}

export const queryMetricsRoutes = new Elysia({ prefix: '/query-metrics' })
  .get(
    '/summary',
    async ({ query }) => {
      const hours = Math.min(Math.max(Number(query.hours ?? 24), 1), 168);
      const sinceMs = Date.now() - hours * 60 * 60 * 1000;

      const db = getMetricsDb();

      const rows = await db
        .select({
          route: requestQueryMetricsD1.route,
          method: requestQueryMetricsD1.method,
          callCount: count(requestQueryMetricsD1.id),
          totalDurationMs: sum(requestQueryMetricsD1.totalDurationMs),
          avgDurationMs: avg(requestQueryMetricsD1.totalDurationMs),
          totalEgressBytes: sum(requestQueryMetricsD1.estimatedEgressBytes),
          avgEgressBytes: avg(requestQueryMetricsD1.estimatedEgressBytes),
        })
        .from(requestQueryMetricsD1)
        .where(gte(requestQueryMetricsD1.capturedAt, sinceMs))
        .groupBy(requestQueryMetricsD1.route, requestQueryMetricsD1.method)
        .orderBy(desc(sum(requestQueryMetricsD1.totalDurationMs)));

      type Row = (typeof rows)[number];
      const normalize = (rows: Row[]) =>
        rows.map((r) => ({
          route: r.route,
          method: r.method,
          callCount: Number(r.callCount),
          totalDurationMs: Number(r.totalDurationMs ?? 0),
          avgDurationMs: Math.round(Number(r.avgDurationMs ?? 0)),
          totalEgressBytes: Number(r.totalEgressBytes ?? 0),
          avgEgressBytes: Math.round(Number(r.avgEgressBytes ?? 0)),
        }));

      const normalized = normalize(rows);

      const topByCompute = [...normalized]
        .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
        .slice(0, 20);

      const topByEgress = [...normalized]
        .sort((a, b) => b.totalEgressBytes - a.totalEgressBytes)
        .slice(0, 20);

      const totalRequests = normalized.reduce((acc, r) => acc + r.callCount, 0);
      const totalDurationMs = normalized.reduce((acc, r) => acc + r.totalDurationMs, 0);
      const totalEgressBytes = normalized.reduce((acc, r) => acc + r.totalEgressBytes, 0);

      return {
        periodHours: hours,
        periodStart: new Date(sinceMs).toISOString(),
        summary: { totalRequests, totalDurationMs, totalEgressBytes },
        topByCompute,
        topByEgress,
      };
    },
    {
      query: z.object({ hours: z.string().optional() }),
      detail: {
        tags: ['Admin'],
        summary: 'Query metrics summary — top routes by compute and egress',
      },
    },
  )

  .get(
    '/recent',
    async ({ query }) => {
      const limit = Math.min(Number(query.limit ?? 50), 200);
      const db = getMetricsDb();

      const requests = await db
        .select({
          id: requestQueryMetricsD1.id,
          capturedAt: requestQueryMetricsD1.capturedAt,
          route: requestQueryMetricsD1.route,
          method: requestQueryMetricsD1.method,
          statusCode: requestQueryMetricsD1.statusCode,
          totalDurationMs: requestQueryMetricsD1.totalDurationMs,
          estimatedEgressBytes: requestQueryMetricsD1.estimatedEgressBytes,
          queryCount: requestQueryMetricsD1.queryCount,
        })
        .from(requestQueryMetricsD1)
        .orderBy(desc(requestQueryMetricsD1.capturedAt))
        .limit(limit);

      return {
        requests: requests.map((r) => ({
          ...r,
          capturedAt: new Date(r.capturedAt).toISOString(),
        })),
      };
    },
    {
      query: z.object({ limit: z.string().optional() }),
      detail: {
        tags: ['Admin'],
        summary: 'Recent API requests with query counts and timing',
      },
    },
  )

  .get(
    '/by-callsite',
    async ({ query }) => {
      const hours = Math.min(Math.max(Number(query.hours ?? 24), 1), 168);
      const limit = Math.min(Number(query.limit ?? 50), 200);
      const sinceMs = Date.now() - hours * 60 * 60 * 1000;

      const db = getMetricsDb();

      // Use SQLite json_each() to unnest the queries JSON array and group by callSite.
      // D1/SQLite json_each returns each array element as q.value (a JSON string).
      const rows = await db.all<{
        call_site: string;
        query_count: number;
        total_duration_ms: number;
        total_result_bytes: number;
        avg_duration_ms: number;
        distinct_routes: number;
        sample_preview: string;
      }>(sql`
        SELECT
          json_extract(q.value, '$.callSite')                              AS call_site,
          COUNT(*)                                                          AS query_count,
          SUM(CAST(json_extract(q.value, '$.durationMs')  AS INTEGER))     AS total_duration_ms,
          SUM(CAST(json_extract(q.value, '$.resultBytes') AS INTEGER))     AS total_result_bytes,
          AVG(CAST(json_extract(q.value, '$.durationMs')  AS INTEGER))     AS avg_duration_ms,
          COUNT(DISTINCT rqm.route)                                         AS distinct_routes,
          MAX(json_extract(q.value, '$.preview'))                           AS sample_preview
        FROM request_query_metrics rqm,
          json_each(rqm.queries) AS q
        WHERE rqm.captured_at >= ${sinceMs}
          AND json_extract(q.value, '$.callSite') IS NOT NULL
        GROUP BY json_extract(q.value, '$.callSite')
        ORDER BY SUM(CAST(json_extract(q.value, '$.durationMs') AS INTEGER)) DESC
        LIMIT ${limit}
      `);

      return {
        periodHours: hours,
        periodStart: new Date(sinceMs).toISOString(),
        callSites: rows.map((r) => ({
          callSite: r.call_site,
          queryCount: Number(r.query_count),
          totalDurationMs: Number(r.total_duration_ms ?? 0),
          totalResultBytes: Number(r.total_result_bytes ?? 0),
          avgDurationMs: Math.round(Number(r.avg_duration_ms ?? 0)),
          distinctRoutes: Number(r.distinct_routes),
          samplePreview: r.sample_preview,
        })),
      };
    },
    {
      query: z.object({ hours: z.string().optional(), limit: z.string().optional() }),
      detail: {
        tags: ['Admin'],
        summary:
          'Per-query compute and egress grouped by call site — exact timing, no approximation',
      },
    },
  )

  .get(
    '/by-month',
    async ({ query }) => {
      const months = Math.min(Math.max(Number(query.months ?? 12), 1), 24);
      const db = getMetricsDb();

      // strftime on Unix-ms: divide by 1000 to get Unix seconds first.
      const rows = await db.all<{
        month: string;
        request_count: number;
        total_duration_ms: number;
        total_egress_bytes: number;
        avg_duration_ms: number;
        total_query_count: number;
      }>(sql`
        SELECT
          strftime('%Y-%m', datetime(captured_at / 1000, 'unixepoch')) AS month,
          COUNT(*)                    AS request_count,
          SUM(total_duration_ms)      AS total_duration_ms,
          SUM(estimated_egress_bytes) AS total_egress_bytes,
          AVG(total_duration_ms)      AS avg_duration_ms,
          SUM(query_count)            AS total_query_count
        FROM request_query_metrics
        GROUP BY month
        ORDER BY month DESC
        LIMIT ${months}
      `);

      return {
        months: rows.map((r) => ({
          month: r.month,
          requestCount: Number(r.request_count),
          totalDurationMs: Number(r.total_duration_ms ?? 0),
          totalEgressBytes: Number(r.total_egress_bytes ?? 0),
          avgDurationMs: Math.round(Number(r.avg_duration_ms ?? 0)),
          totalQueryCount: Number(r.total_query_count ?? 0),
        })),
      };
    },
    {
      query: z.object({ months: z.string().optional() }),
      detail: {
        tags: ['Admin'],
        summary: 'Monthly rollup of request count, compute, and egress — last N calendar months',
      },
    },
  );
