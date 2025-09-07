import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems, packItems } from '@packrat/api/db/schema';
import { CatalogItemSchema, ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { eq } from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Catalog'],
  summary: 'Get catalog item by ID',
  description: 'Retrieve a single catalog item with usage statistics',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        example: '123',
        description: 'Catalog item ID',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Catalog item with usage count',
      content: {
        'application/json': {
          schema: CatalogItemSchema.extend({
            usageCount: z.number().openapi({
              example: 5,
              description: 'Number of packs using this item',
            }),
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

  const item = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, itemId),
    with: {
      packItems: {
        columns: {
          id: true,
        },
        where: eq(packItems.deleted, false),
      },
    },
  });

  if (!item) {
    return c.json({ error: 'Catalog item not found' }, 404);
  }

  // Calculate usage count from related pack items
  const usageCount = item.packItems?.length || 0;

  const { packItems: _packItems, ...itemData } = item;
  return c.json(
    {
      ...itemData,
      usageCount,
    },
    200,
  );
};
