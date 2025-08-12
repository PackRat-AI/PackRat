import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { eq } from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Catalog'],
  summary: 'Delete catalog item',
  description: 'Delete a catalog item by ID (admin only)',
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
      description: 'Catalog item deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
          }),
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
  // TODO: Only admins should be able to delete catalog items
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const itemId = Number(c.req.param('id'));

  // Check if the catalog item exists
  const existingItem = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, itemId),
  });

  if (!existingItem) {
    return c.json({ error: 'Catalog item not found' }, 404);
  }

  // Delete the catalog item
  await db.delete(catalogItems).where(eq(catalogItems.id, itemId));

  return c.json({ success: true }, 200);
};
