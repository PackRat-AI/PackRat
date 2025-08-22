import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems, packs, packWeightHistory } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import { CreatePackRequestSchema, PackWithWeightsSchema } from '@packrat/api/schemas/packs';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { computePacksWeights } from '@packrat/api/utils/compute-pack';
import { and, eq, or } from 'drizzle-orm';

const packsListRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

const listGetRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Packs'],
  summary: 'List user packs',
  description:
    'Get all packs belonging to the authenticated user, optionally including public packs',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      includePublic: z.coerce.number().int().min(0).max(1).optional().default(0).openapi({
        example: 0,
        description: 'Include public packs from other users (0 = false, 1 = true)',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Packs retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(PackWithWeightsSchema),
        },
      },
    },
  },
});

packsListRoutes.openapi(listGetRoute, async (c) => {
  const auth = c.get('user');

  const { includePublic } = c.req.valid('query');
  const includePublicBool = Boolean(includePublic).valueOf();

  const db = createDb(c);
  const where = includePublicBool
    ? and(or(eq(packs.userId, auth.userId), eq(packs.isPublic, true)), eq(packs.deleted, false))
    : eq(packs.userId, auth.userId);

  const result = await db.query.packs.findMany({
    where,
    with: {
      items: includePublicBool ? { where: eq(packItems.deleted, false) } : true,
    },
  });

  return c.json(computePacksWeights(result), 200);
});

const listPostRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Packs'],
  summary: 'Create new pack',
  description: 'Create a new pack for the authenticated user',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePackRequestSchema.extend({
            id: z
              .string()
              .openapi({ example: 'p_123456', description: 'Client-generated pack ID' }),
            localCreatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
            localUpdatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Pack created successfully',
      content: {
        'application/json': {
          schema: PackWithWeightsSchema,
        },
      },
    },
    400: {
      description: 'Bad request - missing pack ID',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packsListRoutes.openapi(listPostRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);
  const data = await c.req.json();

  // Ensure the client provides an ID
  if (!data.id) {
    return c.json({ error: 'Pack ID is required' }, 400);
  }

  const [newPack] = await db
    .insert(packs)
    .values({
      id: data.id,
      userId: auth.userId,
      name: data.name,
      description: data.description,
      category: data.category,
      isPublic: data.isPublic,
      image: data.image,
      tags: data.tags,
      localCreatedAt: new Date(data.localCreatedAt),
      localUpdatedAt: new Date(data.localUpdatedAt),
    })
    .returning();

  if (!newPack) {
    return c.json({ error: 'Failed to create pack' }, 400);
  }

  const packWithItems: PackWithItems = {
    ...newPack,
    items: [],
  };

  const packWithWeights = computePacksWeights([packWithItems])[0];
  return c.json(packWithWeights, 200);
});

const weightHistoryRoute = createRoute({
  method: 'get',
  path: '/weight-history',
  tags: ['Packs'],
  summary: 'Get user weight history',
  description: 'Retrieve all weight history entries for the authenticated user across all packs',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Weight history retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string(),
              packId: z.string(),
              userId: z.number(),
              weight: z.number().openapi({ description: 'Weight in grams' }),
              localCreatedAt: z.string().datetime(),
              createdAt: z.string().datetime(),
              updatedAt: z.string().datetime(),
            }),
          ),
        },
      },
    },
  },
});

packsListRoutes.openapi(weightHistoryRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);
  const userPackWeightHistories = await db.query.packWeightHistory.findMany({
    where: eq(packWeightHistory.userId, auth.userId),
  });

  return c.json(userPackWeightHistories, 200);
});

export { packsListRoutes };
