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

  const result = await db
    .select({ totalCount: count() })
    .from(catalogItems)
    .where(isNull(catalogItems.embedding));
  
  const withoutEmbeddings = result[0]?.totalCount ?? 0;

  const totalItemsResult = await db.select({ totalCount: count() }).from(catalogItems);
  const totalItems = totalItemsResult[0]?.totalCount ?? 0;

  return c.json(
    {
      itemsWithoutEmbeddings: Number(withoutEmbeddings),
      totalItems: Number(totalItems),
    },
    200,
  );
};
