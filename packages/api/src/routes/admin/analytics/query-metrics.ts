import { createDb } from '@packrat/api/db';
import { requestQueryMetrics } from '@packrat/db/schema';
import { avg, count, desc, gte, sql, sum } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { z } from 'zod';

export const queryMetricsRoutes = new Elysia({ prefix: '/query-metrics' })
  .get(
    '/summary',
    async ({ query }) => {
      const hours = Math.min(Math.max(Number(query.hours ?? 24), 1), 168);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const db = createDb();

      // lint:allow-unprojected-fat-table reason: requestQueryMetrics is a narrow metrics table, not a fat table with embeddings
      const rows = await db
        .select({
          route: requestQueryMetrics.route,
          method: requestQueryMetrics.method,
          callCount: count(requestQueryMetrics.id),
          totalDurationMs: sum(requestQueryMetrics.totalDurationMs),
          avgDurationMs: avg(requestQueryMetrics.totalDurationMs),
          totalEgressBytes: sum(requestQueryMetrics.estimatedEgressBytes),
          avgEgressBytes: avg(requestQueryMetrics.estimatedEgressBytes),
        })
        .from(requestQueryMetrics)
        .where(gte(requestQueryMetrics.capturedAt, since))
        .groupBy(requestQueryMetrics.route, requestQueryMetrics.method)
        .orderBy(desc(sum(requestQueryMetrics.totalDurationMs)));

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
        periodStart: since.toISOString(),
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
      const db = createDb();

      const requests = await db
        .select({
          id: requestQueryMetrics.id,
          capturedAt: sql<string>`${requestQueryMetrics.capturedAt}::text`,
          route: requestQueryMetrics.route,
          method: requestQueryMetrics.method,
          statusCode: requestQueryMetrics.statusCode,
          totalDurationMs: requestQueryMetrics.totalDurationMs,
          estimatedEgressBytes: requestQueryMetrics.estimatedEgressBytes,
          queryCount: requestQueryMetrics.queryCount,
        })
        .from(requestQueryMetrics)
        .orderBy(desc(requestQueryMetrics.capturedAt))
        .limit(limit);

      return { requests };
    },
    {
      query: z.object({ limit: z.string().optional() }),
      detail: {
        tags: ['Admin'],
        summary: 'Recent API requests with query counts and timing',
      },
    },
  );
