import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { UserItemsResponseSchema } from '@packrat/api/schemas/users';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { eq } from 'drizzle-orm';

const userItemsRoutes = new OpenAPIHono();

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
    401: {
      description: 'Unauthorized - Invalid or missing authentication token',
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

  return c.json(items, 200);
});

export { userItemsRoutes };
