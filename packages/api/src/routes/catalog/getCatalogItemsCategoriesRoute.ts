import { createRoute, z } from '@hono/zod-openapi';
import { CatalogCategoriesResponseSchema, ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Catalog'],
  summary: 'Get catalog categories',
  description: 'Retrieve all available catalog categories with item counts',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().int().positive().optional().default(10).openapi({
        example: 10,
        description: 'Maximum number of categories to return',
      }),
    }),
  },
  responses: {
    200: {
      description: 'List of catalog categories with counts',
      content: {
        'application/json': {
          schema: CatalogCategoriesResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
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
