import { createRoute } from '@hono/zod-openapi';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/backfill-embeddings',
  responses: {
    200: { description: 'Backfill embeddings for catalog items' },
    500: { description: 'Internal server error' },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const catalogService = new CatalogService(c);
  const result = await catalogService.backfillEmbeddings();

  return c.json({
    success: true,
    message: `Processed ${result.processed} items`,
    ...result,
  });
};
