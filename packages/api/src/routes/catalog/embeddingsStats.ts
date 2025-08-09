import { createRoute } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { count, isNull } from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/embeddings-stats',
  responses: {
    200: { description: 'Get catalog items without embeddings' },
    500: { description: 'Internal server error' },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const db = createDb(c);

  const [{ totalCount }] = await db
    .select({ totalCount: count() })
    .from(catalogItems)
    .where(isNull(catalogItems.embedding));

  const totalItemsResult = await db.select({ totalCount: count() }).from(catalogItems);

  return c.json({
    itemsWithoutEmbeddings: Number(totalCount),
    totalItems: Number(totalItemsResult[0].totalCount),
  });
};
