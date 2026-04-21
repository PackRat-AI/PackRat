import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { type Trip, trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { and, eq } from 'drizzle-orm';
import { CreateTripRequestSchema, TripSchema } from './schemas';

export const routeDefinition = createRoute({
  method: 'put',
  path: '/{tripId}',
  tags: ['Trips'],
  summary: 'Update trip',
  description: 'Update trip info including location as JSON',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ tripId: z.string().openapi({ example: 't_123456' }) }),
    body: {
      content: { 'application/json': { schema: CreateTripRequestSchema.partial() } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Trip updated successfully',
      content: { 'application/json': { schema: TripSchema } },
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
  const data = c.req.valid('json');

  try {
    const updateData: Record<string, unknown> = {};

    if ('name' in data) updateData.name = data.name;
    if ('description' in data) updateData.description = data.description ?? null;
    if ('location' in data) updateData.location = data.location ?? null;
    if ('startDate' in data)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if ('endDate' in data) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if ('notes' in data) updateData.notes = data.notes ?? null;
    if ('packId' in data) updateData.packId = data.packId ?? null;
    if ('localUpdatedAt' in data)
      updateData.localUpdatedAt = data.localUpdatedAt ? new Date(data.localUpdatedAt) : null;

    updateData.updatedAt = new Date();

    await db
      .update(trips)
      .set(updateData)
      .where(and(eq(trips.id, tripId), eq(trips.userId, auth.userId)));

    const updatedTrip: Trip | undefined = await db.query.trips.findFirst({
      where: and(eq(trips.id, tripId), eq(trips.userId, auth.userId)),
    });

    if (!updatedTrip) return c.json({ error: 'Trip not found' }, 404);
    return c.json(updatedTrip, 200);
  } catch (error) {
    console.error('Error updating trip:', error);
    return c.json({ error: 'Failed to update trip' }, 500);
  }
};
