import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import { CatalogItemSchema, ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import {
  and,
  cosineDistance,
  desc,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  ne,
  sql,
} from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{id}/similar',
  tags: ['Catalog'],
  summary: 'Get similar catalog items',
  description: 'Find catalog items similar to the specified item using vector search',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        example: '123',
        description: 'Catalog item ID',
      }),
    }),
    query: z.object({
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? Number(val) : 5))
        .openapi({
          example: '5',
          description: 'Number of similar items to return (default: 5, max: 20)',
        }),
      threshold: z
        .string()
        .optional()
        .transform((val) => (val ? Number(val) : 0.1))
        .openapi({
          example: '0.1',
          description: 'Minimum similarity threshold (default: 0.1)',
        }),
    }),
  },
  responses: {
    200: {
      description: 'List of similar catalog items',
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(
              CatalogItemSchema.omit({ embedding: true }).extend({
                similarity: z.number().openapi({
                  example: 0.85,
                  description: 'Similarity score (0-1, higher is more similar)',
                }),
              }),
            ),
            total: z.number(),
            sourceItem: CatalogItemSchema.omit({ embedding: true }),
          }),
        },
      },
    },
    404: {
      description: 'Catalog item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const db = createDb(c);
  const itemId = Number(c.req.param('id'));
  const { limit, threshold } = c.req.valid('query');

  // Validate limit
  const validLimit = Math.min(Math.max(limit, 1), 20);

  // First, get the source item with its embedding
  const sourceItem = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, itemId),
  });

  if (!sourceItem || !sourceItem.embedding) {
    return c.json({ error: 'Catalog item not found or has no embedding' }, 404);
  }

  // Find similar items using vector search
  const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, sourceItem.embedding)})`;
  const { embedding: _embedding, ...columnsToSelect } = getTableColumns(catalogItems);

  const similarItems = await db
    .select({
      ...columnsToSelect,
      similarity,
    })
    .from(catalogItems)
    .where(
      and(
        gt(similarity, threshold),
        ne(catalogItems.id, itemId),
        isNotNull(catalogItems.embedding),
      ),
    )
    .orderBy(desc(similarity))
    .limit(validLimit);

  // Remove embedding from source item for response
  const { embedding: _sourceEmbedding, ...sourceItemData } = sourceItem;

  return c.json(
    {
      items: similarItems,
      total: similarItems.length,
      sourceItem: sourceItemData,
    },
    200,
  );
};
