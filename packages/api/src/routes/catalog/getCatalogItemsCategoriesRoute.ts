import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CatalogCategoriesResponseSchema } from '@packrat/api/schemas/catalog';
import { CatalogService } from '@packrat/api/services';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';

export const getCatalogItemsCategoriesRoute = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

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
  },
});

getCatalogItemsCategoriesRoute.openapi(routeDefinition, async (c) => {
  const { limit } = c.req.valid('query');
  const categories = await new CatalogService(c).getCategories(limit);

  return c.json(categories, 200);
});
