import { Elysia } from 'elysia';
import { catalogAnalyticsRoutes } from './catalog';
import { dbAnalyticsRoutes } from './db';
import { platformAnalyticsRoutes } from './platform';

export const analyticsRoutes = new Elysia({ prefix: '/analytics' })
  .use(platformAnalyticsRoutes)
  .use(catalogAnalyticsRoutes)
  .use(dbAnalyticsRoutes)
  .get('/', () => ({
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
      db: {
        snapshot: '/api/admin/analytics/db/snapshot',
      },
    },
  }));
