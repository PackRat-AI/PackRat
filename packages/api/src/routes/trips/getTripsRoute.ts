import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { and, eq } from 'drizzle-orm';
import { TripWithPackSchema } from './schemas';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/',
  tags: ['Trips'],
  summary: 'List user trips',
  description: 'Get all trips belonging to the authenticated user.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({}),
  },
  responses: {
    200: {
      description: 'Trips retrieved successfully',
      content: { 'application/json': { schema: z.array(TripWithPackSchema) } },
    },
    500: {
      description: 'Failed to retrieve trips',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);

  try {
    const allTrips = await db.query.trips.findMany({
      where: and(eq(trips.userId, auth.userId), eq(trips.deleted, false)),
      with: { pack: true },
      orderBy: (t) => t.createdAt,
    });

    return c.json(allTrips, 200);
  } catch (error) {
    console.error('Error listing trips:', error);
    return c.json({ error: 'Failed to list trips' }, 500);
  }
};
