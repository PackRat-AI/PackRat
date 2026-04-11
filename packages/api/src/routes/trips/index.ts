import { createDb } from '@packrat/api/db';
import { type Trip, trips } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import { and, eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const LocationSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
  })
  .nullable()
  .optional();

const CreateTripRequestSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  location: LocationSchema,
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  packId: z.string().optional().nullable(),
  localCreatedAt: z.string().datetime(),
  localUpdatedAt: z.string().datetime(),
});

const UpdateTripRequestSchema = CreateTripRequestSchema.partial();

export const tripsRoutes = new Elysia({ prefix: '/trips' })
  .use(authPlugin)

  // List trips
  .get(
    '/',
    async ({ query, user }) => {
      const db = createDb();
      const includePublic = Number(query.includePublic ?? 0);

      try {
        const where = includePublic
          ? and(eq(trips.deleted, false))
          : and(eq(trips.userId, user.userId), eq(trips.deleted, false));

        const allTrips = await db.query.trips.findMany({
          where,
          with: { pack: true },
          orderBy: (t) => t.createdAt,
        });

        return allTrips;
      } catch (error) {
        console.error('Error listing trips:', error);
        return status(500, { error: 'Failed to list trips' });
      }
    },
    {
      query: z.object({
        includePublic: z.coerce.number().int().min(0).max(1).optional().default(0),
      }),
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

      if (!data.id) return status(400, { error: 'Trip ID is required' });

      try {
        const [newTrip] = await db
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

        if (!newTrip) return status(400, { error: 'Failed to create trip' });

        const tripWithPack = data.packId
          ? await db.query.trips.findFirst({
              where: eq(trips.id, newTrip.id),
              with: { pack: true },
            })
          : newTrip;

        return tripWithPack;
      } catch (error) {
        console.error('Error creating trip:', error);
        return status(500, { error: 'Failed to create trip' });
      }
    },
    {
      body: CreateTripRequestSchema,
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

      const trip = await db.query.trips.findFirst({
        where: and(eq(trips.id, tripId), eq(trips.userId, user.userId)),
        with: { pack: true },
      });
      if (!trip) return status(404, { error: 'Trip not found' });
      return trip;
    },
    {
      params: z.object({ tripId: z.string() }),
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

        updateData.updatedAt = new Date();

        await db
          .update(trips)
          .set(updateData)
          .where(and(eq(trips.id, tripId), eq(trips.userId, user.userId)));

        const updatedTrip: Trip | undefined = await db.query.trips.findFirst({
          where: and(eq(trips.id, tripId), eq(trips.userId, user.userId)),
        });

        if (!updatedTrip) return status(404, { error: 'Trip not found' });
        return updatedTrip;
      } catch (error) {
        console.error('Error updating trip:', error);
        return status(500, { error: 'Failed to update trip' });
      }
    },
    {
      params: z.object({ tripId: z.string() }),
      body: UpdateTripRequestSchema,
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

      try {
        const trip = await db.query.trips.findFirst({
          where: and(eq(trips.id, tripId), eq(trips.userId, user.userId)),
        });

        if (!trip) {
          return status(403, { error: 'Trip not found or unauthorized' });
        }

        await db
          .delete(trips)
          .where(and(eq(trips.id, tripId), eq(trips.userId, user.userId)));

        return { success: true };
      } catch (error) {
        console.error('Error deleting trip:', error);
        return status(500, { error: 'Failed to delete trip' });
      }
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
