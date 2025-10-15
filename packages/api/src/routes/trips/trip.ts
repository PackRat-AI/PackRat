import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips, packs, Trip } from '@packrat/api/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';

// ------------------------------
// Initialize Hono instance
// ------------------------------
const tripRoutes = new OpenAPIHono<{
    Bindings: Env;
    Variables: Variables;
}>();

// ------------------------------
// Trip Zod schema
// ------------------------------
const LocationSchema = z
    .object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string().optional(),
    })
    .nullable()
    .optional();

const TripSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    location: LocationSchema,
    startDate: z.string().datetime().nullable().optional(),
    endDate: z.string().datetime().nullable().optional(),
    notes: z.string().nullable().optional(),
    userId: z.number(),
    packId: z.string().nullable().optional(),
    deleted: z.boolean(),
    localCreatedAt: z.string().datetime(),
    localUpdatedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

// ------------------------------
// Create Trip request schema
// ------------------------------
const CreateTripRequestSchema = z.object({
    id: z.string().openapi({
        example: 't_123456',
        description: 'Client-generated trip ID',
    }),
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

// ------------------------------
// Create Trip Route
// ------------------------------
const createTripRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Trips'],
    summary: 'Create a new trip',
    description: 'Create a new trip for the authenticated user',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: { 'application/json': { schema: CreateTripRequestSchema } },
            required: true,
        },
    },
    responses: {
        200: { description: 'Trip created successfully', content: { 'application/json': { schema: TripSchema } } },
        400: { description: 'Bad request', content: { 'application/json': { schema: ErrorResponseSchema } } },
        500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
});

tripRoutes.openapi(createTripRoute, async (c) => {
    const auth = c.get('user');
    const db = createDb(c);
    const data = await c.req.json();

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

        return c.json(newTrip, 200);
    } catch (error) {
        console.error('Error creating trip:', error);
        return c.json({ error: 'Failed to create trip' }, 500);
    }
});

// ------------------------------
// Get Trip by ID Route
// ------------------------------
const getTripRoute = createRoute({
    method: 'get',
    path: '/{tripId}',
    tags: ['Trips'],
    summary: 'Get trip by ID',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ tripId: z.string().openapi({ example: 't_123456' }) }) },
    responses: {
        200: { description: 'Trip retrieved successfully', content: { 'application/json': { schema: TripSchema } } },
        404: { description: 'Trip not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
});

tripRoutes.openapi(getTripRoute, async (c) => {
    const auth = c.get('user');
    const db = createDb(c);
    const tripId = c.req.param('tripId');

    try {
        const trip = await db.query.trips.findFirst({
            where: and(eq(trips.id, tripId), eq(trips.userId, auth.userId)),
            with: { pack: true },
        });
        if (!trip) return c.json({ error: 'Trip not found' }, 404);
        return c.json(trip, 200);
    } catch (error) {
        console.error('Error fetching trip:', error);
        return c.json({ error: 'Failed to fetch trip' }, 500);
    }
});

// ------------------------------
// Update Trip Route
// ------------------------------
const updateTripRoute = createRoute({
    method: 'put',
    path: '/{tripId}',
    tags: ['Trips'],
    summary: 'Update trip',
    description: 'Update trip info including location as JSON',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ tripId: z.string().openapi({ example: 't_123456' }) }),
        body: { content: { 'application/json': { schema: CreateTripRequestSchema.partial() } }, required: true },
    },
    responses: {
        200: { description: 'Trip updated successfully', content: { 'application/json': { schema: TripSchema } } },
        404: { description: 'Trip not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
        500: { description: 'Internal server error', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
});

tripRoutes.openapi(updateTripRoute, async (c) => {
    const auth = c.get('user');
    const db = createDb(c);
    try {
        const tripId = c.req.param('tripId');
        const data = await c.req.json();

        const updateData: Record<string, unknown> = {};

        if ('name' in data) updateData.name = data.name;
        if ('description' in data) updateData.description = data.description ?? null;
        if ('location' in data) updateData.location = data.location ?? null;
        if ('startDate' in data) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
        if ('endDate' in data) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
        if ('notes' in data) updateData.notes = data.notes ?? null;
        if ('packId' in data) updateData.packId = data.packId ?? null;
        if ('deleted' in data) updateData.deleted = data.deleted;
        if ('localUpdatedAt' in data) updateData.localUpdatedAt = data.localUpdatedAt ? new Date(data.localUpdatedAt) : null;

        updateData.updatedAt = new Date();

        await db.update(trips).set(updateData).where(and(eq(trips.id, tripId), eq(trips.userId, auth.userId)));

        const updatedTrip: Trip | undefined = await db.query.trips.findFirst({
            where: and(eq(trips.id, tripId), eq(trips.userId, auth.userId)),
        });

        if (!updatedTrip) return c.json({ error: 'Trip not found' }, 404);
        return c.json(updatedTrip, 200);
    } catch (error) {
        console.error('Error updating trip:', error);
        return c.json({ error: 'Failed to update trip' }, 500);
    }
});

// ------------------------------
// Delete Trip Route
// ------------------------------
const deleteTripRoute = createRoute({
    method: 'delete',
    path: '/{tripId}',
    tags: ['Trips'],
    summary: 'Delete trip',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ tripId: z.string().openapi({ example: 't_123456' }) }) },
    responses: { 200: { description: 'Trip deleted successfully', content: { 'application/json': { schema: z.object({ success: z.boolean() }) } } } },
});

tripRoutes.openapi(deleteTripRoute, async (c) => {
    const db = createDb(c);
    try {
        const tripId = c.req.param('tripId');
        await db.delete(trips).where(eq(trips.id, tripId));
        return c.json({ success: true }, 200);
    } catch (error) {
        console.error('Error deleting trip:', error);
        return c.json({ error: 'Failed to delete trip' }, 500);
    }
});

// ------------------------------
export { tripRoutes };
