import { DbMetricsService } from '@packrat/api/services/dbMetricsService';
import { Elysia, status } from 'elysia';

/**
 * Admin-only DB sizing + activity dashboard endpoints. Surfaces the same
 * metrics from `docs/runbooks/neon-cost-profiling.md` so cost trends are
 * visible without running Neon MCP / SQL editor by hand.
 *
 * Auth: parent admin router's `onBeforeHandle` already gates with
 * adminAuthGuard, so these routes inherit admin-only access.
 *
 * Safety: all queries are pure metadata (pg_class, pg_stat_*) — no row
 * scans on user tables. Safe to poll. No pg_stat_statements dependency.
 */

export const dbAnalyticsRoutes = new Elysia({ prefix: '/db' })
  .get('/', () => ({
    analytics: {
      snapshot: '/api/admin/analytics/db/snapshot',
    },
    description:
      'Read-only DB sizing + activity metrics. Per-table heap/TOAST/index sizes and pg_stat_user_tables counters. See docs/runbooks/neon-cost-profiling.md for what each metric means.',
  }))

  .get(
    '/snapshot',
    async () => {
      try {
        const service = new DbMetricsService();
        return await service.snapshot();
      } catch (error) {
        console.error('db metrics snapshot error:', error);
        return status(500, {
          error: 'Failed to gather DB metrics',
          code: 'ANALYTICS_DB_SNAPSHOT_ERROR',
        });
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Per-table sizing, activity counters, and index utilization',
        description:
          'Returns a snapshot of pg_class sizes (heap/TOAST/index/total) joined with pg_stat_user_tables counters (seq_scan, idx_scan, n_tup_ins/upd/del, live/dead tuples, last autovacuum) plus pg_stat_user_indexes (per-index size + scan count). Pure metadata; no full-table scans.',
      },
    },
  );
