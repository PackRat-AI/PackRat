import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { eq } from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: { 200: { description: 'Get catalog item' } },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const itemId = Number(c.req.param('id'));

  const item = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, itemId),
    with: {
      packItems: {
        columns: {
          id: true,
        },
      },
    },
  });

  if (!item) {
    return c.json({ error: 'Catalog item not found' }, 404);
  }

  // Calculate usage count from related pack items
  const usageCount = item.packItems?.length || 0;

  // biome-ignore lint/correctness/noUnusedVariables: removing packItems from result
  const { packItems, ...itemData } = item;
  return c.json({
    ...itemData,
    usageCount,
  });
};
