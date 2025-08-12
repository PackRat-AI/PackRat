import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packItems, packs } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import {
  CreatePackItemRequestSchema,
  PackItemSchema,
  UpdatePackItemRequestSchema,
} from '@packrat/api/schemas/packs';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';
import { and, eq } from 'drizzle-orm';

const packItemsRoutes = new OpenAPIHono();

// Get all items for a pack
const getItemsRoute = createRoute({
  method: 'get',
  path: '/{packId}/items',
  tags: ['Pack Items'],
  summary: 'Get pack items',
  description:
    'Retrieve all items in a pack. Users can access items from their own packs or public packs.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
  },
  responses: {
    200: {
      description: 'Pack items retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(PackItemSchema),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - pack is private',
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

packItemsRoutes.openapi(getItemsRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const packId = c.req.param('packId');

  // First, get the pack to check ownership and public status
  const pack = await db.query.packs.findFirst({
    where: eq(packs.id, packId),
    columns: {
      id: true,
      userId: true,
      isPublic: true,
    },
  });

  if (!pack) {
    return c.json({ error: 'Pack not found' }, 404);
  }

  // Check if user can access this pack (owns it or it's public)
  const canAccess = pack.isPublic || pack.userId === auth.userId;

  if (!canAccess) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const conditions = [eq(packItems.packId, packId)];
  // Don't include deleted items if pack doesn't belong to user
  // Deleted items are included for user owned packs for sync purposes
  if (pack.userId !== auth.userId) {
    conditions.push(eq(packItems.deleted, false));
  }

  // If authorized, return the pack items
  const items = await db.query.packItems.findMany({
    where: and(...conditions),
    with: {
      catalogItem: true,
    },
  });

  return c.json(items);
});

// Get pack item by ID
const getItemRoute = createRoute({
  method: 'get',
  path: '/items/{itemId}',
  tags: ['Pack Items'],
  summary: 'Get pack item by ID',
  description:
    'Retrieve a specific pack item by its ID. Users can access items from their own packs or public packs.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      itemId: z.string().openapi({ example: 'pi_123456' }),
    }),
  },
  responses: {
    200: {
      description: 'Pack item retrieved successfully',
      content: {
        'application/json': {
          schema: PackItemSchema.extend({
            catalogItem: z
              .object({
                id: z.string(),
                name: z.string(),
                brand: z.string().nullable(),
                category: z.string().nullable(),
                description: z.string().nullable(),
                price: z.number().nullable(),
                weight: z.number().nullable(),
                image: z.string().nullable(),
              })
              .nullable(),
            pack: z
              .object({
                id: z.string(),
                name: z.string(),
                isPublic: z.boolean(),
              })
              .nullable(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - item is private',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packItemsRoutes.openapi(getItemRoute, async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const userId = auth.userId;
  const itemId = c.req.param('itemId');

  const item = await db.query.packItems.findFirst({
    where: eq(packItems.id, itemId),
    with: {
      catalogItem: true,
      pack: true,
    },
  });

  if (!item) {
    return c.json({ error: 'Item not found' }, { status: 404 });
  }

  const isOwner = item.userId === userId;
  const isPublic = item.pack?.isPublic;

  if (!isOwner && !isPublic) {
    return c.json({ error: 'Unauthorized' }, { status: 403 });
  }

  return c.json(item);
});

// Add an item to a pack
const addItemRoute = createRoute({
  method: 'post',
  path: '/{packId}/items',
  tags: ['Pack Items'],
  summary: 'Add item to pack',
  description: 'Add a new item to a pack with automatic embedding generation for AI features',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreatePackItemRequestSchema.extend({
            id: z
              .string()
              .openapi({ example: 'pi_123456', description: 'Client-generated item ID' }),
            catalogItemId: z
              .number()
              .optional()
              .openapi({ example: 12345, description: 'Reference to catalog item' }),
            consumable: z.boolean().optional().default(false),
            worn: z.boolean().optional().default(false),
            notes: z.string().optional(),
            weightUnit: z.string().optional().default('g'),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Item added to pack successfully',
      content: {
        'application/json': {
          schema: PackItemSchema,
        },
      },
    },
    400: {
      description: 'Bad request - missing required fields',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - embedding generation failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packItemsRoutes.openapi(addItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const packId = c.req.param('packId');
  const data = await c.req.json();
  const {
    OPENAI_API_KEY,
    AI_PROVIDER,
    CLOUDFLARE_ACCOUNT_ID_ORG,
    CLOUDFLARE_AI_GATEWAY_ID_ORG,
    AI,
  } = getEnv(c);

  if (!OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }

  if (!packId) {
    return c.json({ error: 'Pack ID is required' }, 400);
  }

  if (!data.id) {
    return c.json({ error: 'Item ID is required' }, 400);
  }

  // Generate embedding
  const embeddingText = getEmbeddingText(data);
  const embedding = await generateEmbedding({
    openAiApiKey: OPENAI_API_KEY,
    value: embeddingText,
    provider: AI_PROVIDER,
    cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID_ORG,
    cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID_ORG,
    cloudflareAiBinding: AI,
  });

  const [newItem] = await db
    .insert(packItems)
    .values({
      id: data.id,
      packId: packId,
      catalogItemId: data.catalogItemId ? Number(data.catalogItemId) : null,
      name: data.name,
      description: data.description,
      weight: data.weight,
      weightUnit: data.weightUnit,
      quantity: data.quantity || 1,
      category: data.category,
      consumable: data.consumable || false,
      worn: data.worn || false,
      image: data.image,
      notes: data.notes,
      userId: auth.userId,
      embedding: embedding,
    })
    .returning();

  await db.update(packs).set({ updatedAt: new Date() }).where(eq(packs.id, packId));

  return c.json(newItem);
});

// Update a pack item
const updateItemRoute = createRoute({
  method: 'patch',
  path: '/items/{itemId}',
  tags: ['Pack Items'],
  summary: 'Update pack item',
  description: 'Update pack item details with automatic embedding regeneration when text changes',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      itemId: z.string().openapi({ example: 'pi_123456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePackItemRequestSchema.extend({
            consumable: z.boolean().optional(),
            worn: z.boolean().optional(),
            notes: z.string().optional(),
            weightUnit: z.string().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Item updated successfully',
      content: {
        'application/json': {
          schema: PackItemSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error - embedding generation failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packItemsRoutes.openapi(updateItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  const itemId = c.req.param('itemId');
  const data = await c.req.json();
  const {
    OPENAI_API_KEY,
    AI_PROVIDER,
    CLOUDFLARE_ACCOUNT_ID_ORG,
    CLOUDFLARE_AI_GATEWAY_ID_ORG,
    AI,
  } = getEnv(c);

  if (!OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }

  const existingItem = await db.query.packItems.findFirst({
    where: and(eq(packItems.id, itemId), eq(packItems.userId, auth.userId)),
  });

  if (!existingItem) {
    return c.json({ error: 'Pack item not found' }, 404);
  }

  // Only generate a new embedding if the text has changed
  const newEmbeddingText = getEmbeddingText(data, existingItem);
  const oldEmbeddingText = getEmbeddingText(existingItem);

  const updateData: Partial<typeof packItems.$inferInsert> = {};
  if ('name' in data) updateData.name = data.name;
  if ('description' in data) updateData.description = data.description;
  if ('weight' in data) updateData.weight = data.weight;
  if ('weightUnit' in data) updateData.weightUnit = data.weightUnit;
  if ('quantity' in data) updateData.quantity = data.quantity;
  if ('category' in data) updateData.category = data.category;
  if ('consumable' in data) updateData.consumable = data.consumable;
  if ('worn' in data) updateData.worn = data.worn;
  if ('image' in data) updateData.image = data.image;
  if ('notes' in data) updateData.notes = data.notes;
  if ('deleted' in data) updateData.deleted = data.deleted;

  if (newEmbeddingText !== oldEmbeddingText) {
    updateData.embedding = await generateEmbedding({
      openAiApiKey: OPENAI_API_KEY,
      value: newEmbeddingText,
      provider: AI_PROVIDER,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID_ORG,
      cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID_ORG,
      cloudflareAiBinding: AI,
    });
  }

  updateData.updatedAt = new Date();

  // Delete old image from R2 if we are changing image
  if ('image' in data) {
    let oldImage: string | null = null;
    try {
      const item = await db.query.packItems.findFirst({
        where: and(eq(packItems.id, itemId), eq(packItems.userId, auth.userId)),
      });

      oldImage = item?.image ?? null;

      // Nothing to delete if old image is null
      if (oldImage) {
        // Use R2 bucket binding for deletion
        const { PACKRAT_BUCKET } = getEnv(c);
        await PACKRAT_BUCKET.delete(oldImage);
      }
    } catch (error) {
      // Silently fail because this op shouldn't prevent the update
      console.error('Error deleting old image from R2:', error);
      const sentry = c.get('sentry');
      sentry.setTag('location', 'updateItemRoute/deleteOldImage');
      sentry.setContext('params', {
        itemId,
        oldImage,
        userId: auth.userId,
      });
      sentry.captureException(error);
    }
  }

  const [updatedItem] = await db
    .update(packItems)
    .set(updateData)
    .where(and(eq(packItems.id, itemId), eq(packItems.userId, auth.userId)))
    .returning();

  if (!updatedItem) {
    return c.json({ error: 'Pack item not found' }, 404);
  }

  // Update the pack's updatedAt timestamp
  await db.update(packs).set({ updatedAt: new Date() }).where(eq(packs.id, updatedItem.packId));

  return c.json(updatedItem[0]);
});

// Delete a pack item
const deleteItemRoute = createRoute({
  method: 'delete',
  path: '/items/{itemId}',
  tags: ['Pack Items'],
  summary: 'Delete pack item',
  description: 'Permanently remove an item from a pack',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      itemId: z.string().openapi({ example: 'pi_123456' }),
    }),
  },
  responses: {
    200: {
      description: 'Item deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            itemId: z.string().openapi({ example: 'pi_123456' }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packItemsRoutes.openapi(deleteItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  const itemId = c.req.param('itemId');

  const item = await db.query.packItems.findFirst({
    where: and(eq(packItems.id, itemId), eq(packItems.userId, auth.userId)),
  });

  if (!item) {
    return c.json({ error: 'Pack item not found' }, 404);
  }

  const packId = item.packId;

  await db.delete(packItems).where(eq(packItems.id, itemId));

  await db.update(packs).set({ updatedAt: new Date() }).where(eq(packs.id, packId));

  return c.json({ success: true, itemId: itemId });
});

export { packItemsRoutes };
