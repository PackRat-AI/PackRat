import { createRoute, z } from '@hono/zod-openapi';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/categories',
  request: {
    query: z.object({
      limit: z.coerce.number().int().positive().optional().default(10),
    }),
  },
  responses: { 200: { description: 'Get catalog categories' } },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { limit } = c.req.valid('query');
  const categories = await new CatalogService(c).getCategories(limit);

  return c.json(categories);
};
