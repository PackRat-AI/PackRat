import { createRoute } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { eq } from 'drizzle-orm';
import { CreateTripRequestSchema, TripWithPackSchema } from './schemas';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/',
  tags: ['Trips'],
  summary: 'Create new trip',
  description: 'Create a new trip for the authenticated user',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateTripRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Trip created successfully',
      content: { 'application/json': { schema: TripWithPackSchema } },
    },
    400: {
      description: 'Bad request - missing trip ID or invalid data',
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
  const data = c.req.valid('json');

  if (!data.id) return c.json({ error: 'Trip ID is required' }, 400);

  try {
    const [newTrip] = await db
      .insert(trips)
      .values({
        id: data.id,
        userId: auth.userId,
        name: data.name,
        description: data.description ?? null,
        location: data.location ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes ?? null,
        packId: data.packId ?? null,
        deleted: false,
        localCreatedAt: new Date(data.localCreatedAt),
        localUpdatedAt: new Date(data.localUpdatedAt),
      })
      .returning();

    if (!newTrip) return c.json({ error: 'Failed to create trip' }, 400);

    const tripWithPack = data.packId
      ? await db.query.trips.findFirst({ where: eq(trips.id, newTrip.id), with: { pack: true } })
      : newTrip;

    if (!tripWithPack) return c.json({ error: 'Failed to create trip' }, 400);

    return c.json(tripWithPack, 200);
  } catch (error) {
    console.error('Error creating trip:', error);
    return c.json({ error: 'Failed to create trip' }, 500);
  }
};
