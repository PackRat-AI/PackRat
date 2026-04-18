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
        overview: '/api/admin/analytics/catalog/overview',
        brands: '/api/admin/analytics/catalog/brands',
        prices: '/api/admin/analytics/catalog/prices',
        etl: '/api/admin/analytics/catalog/etl',
        embeddings: '/api/admin/analytics/catalog/embeddings',
      },
    },
  }),
);
