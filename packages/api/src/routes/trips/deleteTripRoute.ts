import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { eq } from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'delete',
  path: '/{tripId}',
  tags: ['Trips'],
  summary: 'Delete trip',
  description: 'Delete a trip owned by the authenticated user',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ tripId: z.string().openapi({ example: 't_123456' }) }),
  },
  responses: {
    200: {
      description: 'Trip deleted successfully',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    403: {
      description: 'Forbidden - user not authorized to delete this trip',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Trip not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const { tripId } = c.req.valid('param');

  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, tripId),
    });

    if (!trip) return c.json({ error: 'Trip not found' }, 404);
    if (trip.userId !== auth.userId) return c.json({ error: 'Forbidden' }, 403);

    await db.delete(trips).where(eq(trips.id, tripId));

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting trip:', error);
    return c.json({ error: 'Failed to delete trip' }, 500);
  }
};
