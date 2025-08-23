import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { UserItemsResponseSchema } from '@packrat/api/schemas/users';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { eq } from 'drizzle-orm';

const userItemsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Get all pack items for the authenticated user
const userItemsGetRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['Users'],
  summary: 'Get user items',
  description: 'Retrieve all pack items belonging to the authenticated user across all their packs',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'User items retrieved successfully',
      content: {
        'application/json': {
          schema: UserItemsResponseSchema,
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

userItemsRoutes.openapi(userItemsGetRoute, async (c) => {
  try {
    const auth = c.get('user');
    const db = createDb(c);

    const items = await db.query.packItems.findMany({
      where: eq(packItems.userId, auth.userId),
      with: {
        catalogItem: true,
      },
    });

    return c.json(items, 200);
  } catch (error) {
    console.error('Error fetching user items:', error);
    return c.json({ error: 'Internal server error', code: 'FETCH_ERROR' }, 500);
  }
});

export { userItemsRoutes };
