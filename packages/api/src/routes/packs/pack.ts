import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import {
  catalogItems,
  type NewPack,
  type PackWithItems,
  packItems,
  packs,
  packWeightHistory,
} from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import {
  ItemSuggestionsRequestSchema,
  PackWithWeightsSchema,
  UpdatePackRequestSchema,
} from '@packrat/api/schemas/packs';
import type { Variables } from '@packrat/api/types/variables';
import { computePackWeights } from '@packrat/api/utils/compute-pack';
import { getPackDetails } from '@packrat/api/utils/DbUtils';
import type { Env } from '@packrat/api/utils/env-validation';
import { and, cosineDistance, desc, eq, gt, notInArray, sql } from 'drizzle-orm';

const packRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Get a specific pack
const getPackRoute = createRoute({
  method: 'get',
  path: '/{packId}',
  tags: ['Packs'],
  summary: 'Get pack by ID',
  description: 'Retrieve a specific pack by its ID with all items',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
  },
  responses: {
    200: {
      description: 'Pack retrieved successfully',
      content: {
        'application/json': {
          schema: PackWithWeightsSchema,
        },
      },
    },
    404: {
      description: 'Pack not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packRoutes.openapi(getPackRoute, async (c) => {
  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    const pack = await db.query.packs.findFirst({
      where: eq(packs.id, packId),
      with: {
        items: {
          where: eq(packItems.deleted, false),
        },
      },
    });

    if (!pack) {
      return c.json({ error: 'Pack not found' }, 404);
    }
    return c.json(pack, 200);
  } catch (error) {
    console.error('Error fetching pack:', error);
    return c.json({ error: 'Failed to fetch pack' }, 500);
  }
});

// Update a pack
const updatePackRoute = createRoute({
  method: 'put',
  path: '/{packId}',
  tags: ['Packs'],
  summary: 'Update pack',
  description: 'Update pack information such as name, description, category, and visibility',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePackRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Pack updated successfully',
      content: {
        'application/json': {
          schema: PackWithWeightsSchema,
        },
      },
    },
    404: {
      description: 'Pack not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packRoutes.openapi(updatePackRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    const data = await c.req.json();

    // Create update object with only the provided fields
    const updateData: Partial<NewPack> = {};
    if ('name' in data) updateData.name = data.name;
    if ('description' in data) updateData.description = data.description;
    if ('category' in data) updateData.category = data.category;
    if ('isPublic' in data) updateData.isPublic = data.isPublic;
    if ('image' in data) updateData.image = data.image;
    if ('tags' in data) updateData.tags = data.tags;
    if ('deleted' in data) updateData.deleted = data.deleted;
    if ('localUpdatedAt' in data) updateData.localUpdatedAt = new Date(data.localUpdatedAt);

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    await db
      .update(packs)
      .set(updateData)
      .where(and(eq(packs.id, packId), eq(packs.userId, auth.userId)));

    const updatedPack: PackWithItems | undefined = await db.query.packs.findFirst({
      where: and(eq(packs.id, packId), eq(packs.userId, auth.userId)),
      with: {
        items: true,
      },
    });

    if (!updatedPack) {
      return c.json({ error: 'Pack not found' }, 404);
    }

    const packWithWeights = computePackWeights(updatedPack);
    return c.json(packWithWeights, 200);
  } catch (error) {
    console.error('Error updating pack:', error);
    return c.json({ error: 'Failed to update pack' }, 500);
  }
});

// Delete a pack
const deletePackRoute = createRoute({
  method: 'delete',
  path: '/{packId}',
  tags: ['Packs'],
  summary: 'Delete pack',
  description: 'Permanently delete a pack and all its items',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
  },
  responses: {
    200: {
      description: 'Pack deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
          }),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packRoutes.openapi(deletePackRoute, async (c) => {
  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    await db.delete(packs).where(eq(packs.id, packId));
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error deleting pack:', error);
    return c.json({ error: 'Failed to delete pack' }, 500);
  }
});

const itemSuggestionsRoute = createRoute({
  method: 'post',
  path: '/{packId}/item-suggestions',
  tags: ['Packs'],
  summary: 'Get item suggestions for pack',
  description:
    'Get AI-powered item suggestions based on existing pack items using similarity matching',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: ItemSuggestionsRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Item suggestions retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              image: z.string().nullable(),
              category: z.string().nullable(),
              similarity: z.number(),
            }),
          ),
        },
      },
    },
    400: {
      description: 'Bad request - no embeddings found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Pack not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packRoutes.openapi(itemSuggestionsRoute, async (c) => {
  const db = createDb(c);
  const packId = c.req.param('packId');

  const pack = await getPackDetails({ packId, c });
  if (!pack) {
    return c.json({ error: 'Pack not found' }, 404);
  }

  const existingEmbeddings = pack.items
    .map((item) => item.embedding)
    .filter((e): e is number[] => Array.isArray(e) && e.length > 0);

  if (existingEmbeddings.length === 0) {
    console.warn('[ItemSuggestions] No embeddings found in items');
    return c.json({ error: 'No embeddings found for existing items' }, 400);
  }

  const avgEmbedding = existingEmbeddings[0].map(
    (_, i) => existingEmbeddings.reduce((sum, emb) => sum + emb[i], 0) / existingEmbeddings.length,
  );

  const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, avgEmbedding)})`;

  const existingCatalogIds = pack.items
    .map((item) => item.catalogItemId)
    .filter((id): id is number => typeof id === 'number');

  const whereConditions = [gt(similarity, 0.1)];
  if (existingCatalogIds.length > 0) {
    whereConditions.push(notInArray(catalogItems.id, existingCatalogIds));
  }

  const similarItems = await db
    .select({
      id: catalogItems.id,
      name: catalogItems.name,
      images: catalogItems.images,
      categories: catalogItems.categories,
      similarity,
    })
    .from(catalogItems)
    .where(and(...whereConditions))
    .orderBy(desc(similarity))
    .limit(5);

  return c.json(similarItems, 200);
});

const weightHistoryRoute = createRoute({
  method: 'post',
  path: '/{packId}/weight-history',
  tags: ['Packs'],
  summary: 'Create pack weight history entry',
  description: 'Record a weight history entry for pack tracking over time',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().openapi({ example: 'pwh_123456' }),
            weight: z.number().openapi({ example: 5500, description: 'Weight in grams' }),
            localCreatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Weight history entry created successfully',
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string(),
              packId: z.string(),
              userId: z.number(),
              weight: z.number(),
              localCreatedAt: z.string().datetime(),
              createdAt: z.string().datetime(),
              updatedAt: z.string().datetime(),
            }),
          ),
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packRoutes.openapi(weightHistoryRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    const data = await c.req.json();

    const packWeightHistoryEntry = await db
      .insert(packWeightHistory)
      .values({
        id: data.id,
        packId,
        userId: auth.userId,
        weight: data.weight,
        localCreatedAt: new Date(data.localCreatedAt),
      })
      .returning();

    return c.json(packWeightHistoryEntry, 200);
  } catch (error) {
    console.error('Pack weight history API error:', error);
    return c.json({ error: 'Failed to create weight history entry' }, 500);
  }
});

export { packRoutes };
