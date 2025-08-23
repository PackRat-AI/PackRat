import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { apiKeyAuthMiddleware } from '@packrat/api/middleware';
import { CatalogService } from '@packrat/api/services';
import type { Env } from '@packrat/api/types/env';

export const backfillEmbeddingsRoute = new OpenAPIHono<{ Bindings: Env }>();

const routeDefinition = createRoute({
  method: 'post',
  path: '/backfill-embeddings',
  responses: {
    200: { description: 'Backfill embeddings for catalog items' },
    500: { description: 'Internal server error' },
  },
});

backfillEmbeddingsRoute.use('*', apiKeyAuthMiddleware);

backfillEmbeddingsRoute.openapi(routeDefinition, async (c) => {
  const catalogService = new CatalogService(c);
  const { count } = await catalogService.queueEmbeddingJobs();

  return c.json(
    {
      success: true,
      message: `Queued ${count} items`,
    },
    200,
  );
});
