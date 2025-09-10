import { createRoute, z } from '@hono/zod-openapi';
import { CatalogItemSchema, ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { CatalogService } from '@packrat/api/services';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import type { Context } from 'hono';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/vector-search',
  tags: ['Catalog'],
  summary: 'Vector search catalog items',
  description: 'Search catalog items using vector similarity with natural language queries',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            query: z.string().min(1).openapi({
              example: 'lightweight backpacking tent',
              description: 'Natural language search query',
            }),
            limit: z.number().int().min(1).max(100).optional().default(10).openapi({
              example: 10,
              description: 'Maximum number of results to return',
            }),
            offset: z.number().int().min(0).optional().default(0).openapi({
              example: 0,
              description: 'Number of results to skip for pagination',
            }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Vector search results',
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(
              CatalogItemSchema.extend({
                similarity: z.number().min(0).max(1).openapi({
                  example: 0.85,
                  description: 'Similarity score between 0 and 1',
                }),
              }),
            ),
            total: z.number().openapi({ example: 150 }),
            limit: z.number().openapi({ example: 10 }),
            offset: z.number().openapi({ example: 0 }),
            nextOffset: z.number().openapi({ example: 10 }),
          }),
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

export async function handler(c: Context<{ Bindings: Env; Variables: Variables }>) {
  try {
    const { query, limit = 10, offset = 0 } = await c.req.json();

    if (!query || query.trim() === '') {
      return c.json({ error: 'Query is required' }, 400);
    }

    const catalogService = new CatalogService(c);
    const result = await catalogService.vectorSearch(query, limit, offset);

    return c.json(result, 200);
  } catch (error) {
    console.error('Vector search error:', error);
    return c.json({ error: 'Failed to search catalog items' }, 500);
  }
}
