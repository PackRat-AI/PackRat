import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { trips, packs } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, eq, or } from 'drizzle-orm';

const tripsListRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TripWithPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  userId: z.number(),
  packId: z.string().nullable().optional(),
  deleted: z.boolean(),
  localCreatedAt: z.string().datetime().optional(),
  localUpdatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

}).openapi('Trip');

// ---------------------------------------------------------------------------
// GET /api/trips
// ---------------------------------------------------------------------------
const listGetRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Trips'],
  summary: 'List user trips',
  description:
    'Get all trips belonging to the authenticated user, optionally including public trips.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      includePublic: z.coerce.number().int().min(0).max(1).optional().default(0).openapi({
        example: 0,
        description: 'Include public trips from other users (0 = false, 1 = true)',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Trips retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(TripWithPackSchema),
        },
      },
    },
    500: {
      description: 'Failed to retrieve trips',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

tripsListRoutes.openapi(listGetRoute, async (c) => {
  console.log("Listing trips...");
  const auth = c.get('user');
  const db = createDb(c);

  try {

    const where = and(
      eq(trips.userId, auth.userId),
      eq(trips.deleted, false)
    );

    const allTrips = await db.query.trips.findMany({
      where,
      with: {
        pack: true,
      },
      orderBy: (t) => t.createdAt,
    });

    return c.json(allTrips, 200);
  } catch (error) {
    console.error('Error listing trips:', error);
    return c.json({ error: 'Failed to list trips' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/trips
// ---------------------------------------------------------------------------

// const CreateTripRequestSchema = z.object({
//   id: z.string().openapi({ example: 't_123456' }),
//   name: z.string().min(1),
//   description: z.string().nullable().optional(),
//   location: z.string().nullable().optional(),
//   startDate: z.string().datetime().nullable().optional(),
//   endDate: z.string().datetime().nullable().optional(),
//   notes: z.string().nullable().optional(),
//   packId: z.string().nullable().optional(),
//   localCreatedAt: z.string().datetime(),
//   localUpdatedAt: z.string().datetime(),
// });

// const listPostRoute = createRoute({
//   method: 'post',
//   path: '/',
//   tags: ['Trips'],
//   summary: 'Create new trip',
//   description: 'Create a new trip for the authenticated user',
//   security: [{ bearerAuth: [] }],
//   request: {
//     body: {
//       content: {
//         'application/json': { schema: CreateTripRequestSchema },
//       },
//       required: true,
//     },
//   },
//   responses: {
//     200: {
//       description: 'Trip created successfully',
//       content: { 'application/json': { schema: TripWithPackSchema } },
//     },
//     400: {
//       description: 'Bad request - missing trip ID or invalid data',
//       content: { 'application/json': { schema: ErrorResponseSchema } },
//     },
//   },
// });

// tripsListRoutes.openapi(listPostRoute, async (c) => {
//   const auth = c.get('user');
//   const db = createDb(c);
//   const data = await c.req.json();

//   if (!data.id) {
//     return c.json({ error: 'Trip ID is required' }, 400);
//   }

//   try {
//     const [newTrip] = await db
//       .insert(trips)
//       .values({
//         id: data.id,
//         userId: auth.userId,
//         name: data.name,
//         description: data.description,
//         location: data.location,
//         startDate: data.startDate ? data.startDate : null,
//         endDate: data.endDate ? data.endDate : null,
//         notes: data.notes,
//         packId: data.packId,
//         deleted: false,
//         localCreatedAt: new Date(data.localCreatedAt),
//         localUpdatedAt: new Date(data.localUpdatedAt),
//       })
//       .returning();

//     if (!newTrip) {
//       return c.json({ error: 'Failed to create trip' }, 400);
//     }

//     const tripWithPack = data.packId
//       ? await db.query.trips.findFirst({
//         where: eq(trips.id, newTrip.id),
//         with: { pack: true },
//       })
//       : newTrip;

//     return c.json(tripWithPack, 200);
//   } catch (error) {
//     console.error('Error creating trip:', error);
//     return c.json({ error: 'Failed to create trip' }, 500);
//   }
// });

// ---------------------------------------------------------------------------

export { tripsListRoutes };
