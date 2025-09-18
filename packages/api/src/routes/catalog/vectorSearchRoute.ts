import { createRoute } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  VectorSearchQuerySchema,
  VectorSearchResponseSchema,
} from '@packrat/api/schemas/catalog';
import { CatalogService } from '@packrat/api/services';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/vector-search',
  tags: ['Catalog'],
  summary: 'Vector search catalog items',
  description: 'Search catalog items using vector similarity with natural language queries',
  security: [{ bearerAuth: [] }],
  request: {
    query: VectorSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Vector search results',
      content: {
        'application/json': {
          schema: VectorSearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - invalid query',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  try {
    const { q: query, limit = 10, offset = 0 } = c.req.valid('query');

    const catalogService = new CatalogService(c);
    const result = await catalogService.vectorSearch(query, limit, offset);

    return c.json(result, 200);
  } catch (error) {
    console.error('Vector search error:', error);
    return c.json({ error: 'Failed to search catalog items' }, 500);
  }
};
