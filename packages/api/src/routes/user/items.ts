import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { eq } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const userItemsRoutes = new OpenAPIHono();

// Get all pack items for the authenticated user
const userItemsGetRoute = createRoute({
  method: 'get',
  path: '/items',
  responses: { 200: { description: "Get user's items" } },
});

userItemsRoutes.openapi(userItemsGetRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  const items = await db.query.packItems.findMany({
    where: eq(packItems.userId, auth.userId),
    with: {
      catalogItem: true,
    },
  });

  return c.json(items);
});

export { userItemsRoutes };
