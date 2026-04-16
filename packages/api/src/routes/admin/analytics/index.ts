import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import { catalogRoutes } from './catalog';
import { platformRoutes } from './platform';

export const analyticsRoutes = new OpenAPIHono<{ Bindings: Env }>();

// ─── Sub-routers ─────────────────────────────────────────────────────────────

analyticsRoutes.route('/platform', platformRoutes);
analyticsRoutes.route('/catalog', catalogRoutes);

// ─── Analytics root ───────────────────────────────────────────────────────────

analyticsRoutes.get('/', (c) =>
  c.json({
    analytics: {
      platform: {
        growth: '/api/admin/analytics/platform/growth',
        activity: '/api/admin/analytics/platform/activity',
        breakdown: '/api/admin/analytics/platform/breakdown',
      },
      catalog: {
        dashboard: '/api/admin/analytics/catalog',
        health: '/api/admin/analytics/catalog/health',
      },
    },
  }),
);
