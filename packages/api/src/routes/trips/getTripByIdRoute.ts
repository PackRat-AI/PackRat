import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { and, eq } from 'drizzle-orm';
import { TripWithPackSchema } from './schemas';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{tripId}',
  tags: ['Trips'],
  summary: 'Get trip by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ tripId: z.string().openapi({ example: 't_123456' }) }),
  },
  responses: {
    200: {
      description: 'Trip retrieved successfully',
      content: { 'application/json': { schema: TripWithPackSchema } },
    },
    404: {
      description: 'Trip not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const { tripId } = c.req.valid('param');

  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.userId, auth.userId), eq(trips.deleted, false)),
    with: { pack: true },
  });

  if (!trip) return c.json({ error: 'Trip not found' }, 404);
  return c.json(trip, 200);
};
