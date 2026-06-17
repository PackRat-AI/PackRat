import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { trips } from '@packrat/db';
import { CreateTripBodySchema, TripSchema, UpdateTripBodySchema } from '@packrat/schemas/trips';
import { and, eq } from 'drizzle-orm';
import { Elysia, NotFoundError, status } from 'elysia';
import { z } from 'zod';

export const tripsRoutes = new Elysia({ prefix: '/trips' })
  .model({
    'trips.CreateTripBody': CreateTripBodySchema,
    'trips.Trip': TripSchema,
    'trips.UpdateTripBody': UpdateTripBodySchema,
  })
  .use(authPlugin)

  // List trips
  .get(
    '/',
    async ({ user }) => {
      const db = createDb();

      try {
        const allTrips = await db.tag('trips.list').query.trips.findMany({
          where: and(eq(trips.userId, user.userId), eq(trips.deleted, false)),
          orderBy: (t) => t.createdAt,
        });

        return z.array(TripSchema).parse(allTrips);
      } catch (error) {
        console.error('Error listing trips:', error);
        throw error;
      }
    },
    {
      response: { 200: z.array(TripSchema) }, // array — stays inline (item schema is referenced via .model())
      isAuthenticated: true,
      detail: {
        tags: ['Trips'],
        summary: 'List user trips',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Create trip
  .post(
    '/',
    async ({ body, user }) => {
      const db = createDb();
      const data = body;

      try {
        const [newTrip] = await db
          .tag('trips.create')
          .insert(trips)
          .values({
            id: data.id,
            userId: user.userId,
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

        if (!newTrip) throw new Error('Failed to create trip');

        return TripSchema.parse(newTrip);
      } catch (error) {
        console.error('Error creating trip:', error);
        throw error;
      }
    },
    {
      body: 'trips.CreateTripBody',
      response: { 200: 'trips.Trip' },
      isAuthenticated: true,
      detail: {
        tags: ['Trips'],
        summary: 'Create new trip',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Get trip by ID
  .get(
    '/:tripId',
    async ({ params, user }) => {
      const db = createDb();
      const tripId = params.tripId;

      const trip = await db.tag('trips.getById').query.trips.findFirst({
        where: and(eq(trips.id, tripId), eq(trips.userId, user.userId)),
      });
      if (!trip) throw new NotFoundError('Trip not found');
      return TripSchema.parse(trip);
    },
    {
      params: z.object({ tripId: z.string() }),
      response: { 200: 'trips.Trip' },
      isAuthenticated: true,
      detail: {
        tags: ['Trips'],
        summary: 'Get trip by ID',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update trip
  .put(
    '/:tripId',
    async ({ params, body, user }) => {
      const db = createDb();
      try {
        const tripId = params.tripId;
        const data = body;

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
        if ('deleted' in data) updateData.deleted = data.deleted;

        updateData.updatedAt = new Date();

        await db
          .tag('trips.update')
          .update(trips)
          .set(updateData)
          .where(and(eq(trips.id, tripId), eq(trips.userId, user.userId)));

        const updatedTrip = await db.tag('trips.getById').query.trips.findFirst({
          where: and(eq(trips.id, tripId), eq(trips.userId, user.userId)),
        });

        if (!updatedTrip) throw new NotFoundError('Trip not found');
        return TripSchema.parse(updatedTrip);
      } catch (error) {
        console.error('Error updating trip:', error);
        throw error;
      }
    },
    {
      params: z.object({ tripId: z.string() }),
      body: 'trips.UpdateTripBody',
      response: { 200: 'trips.Trip' },
      isAuthenticated: true,
      detail: {
        tags: ['Trips'],
        summary: 'Update trip',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete trip
  .delete(
    '/:tripId',
    async ({ params, user }) => {
      const db = createDb();
      const tripId = params.tripId;

      const [deleted] = await db
        .tag('trips.delete')
        .update(trips)
        .set({ deleted: true, updatedAt: new Date() })
        .where(and(eq(trips.id, tripId), eq(trips.userId, user.userId)))
        .returning();

      if (!deleted) return status(404, { error: 'Trip not found' });
      return { success: true };
    },
    {
      params: z.object({ tripId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trips'],
        summary: 'Delete trip',
        security: [{ bearerAuth: [] }],
      },
    },
  );
