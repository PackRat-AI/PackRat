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
  GapAnalysisRequestSchema,
  GapAnalysisResponseSchema,
  PackWithWeightsSchema,
  UpdatePackRequestSchema,
} from '@packrat/api/schemas/packs';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { computePackWeights } from '@packrat/api/utils/compute-pack';
import { getPackDetails } from '@packrat/api/utils/DbUtils';
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
    return c.json(computePackWeights(pack), 200);
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
  const auth = c.get('user');
  const packId = c.req.param('packId');

  try {
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
          schema: z.object({
            existingCatalogItemIds: z.array(z.number()).openapi({
              example: [101, 202, 303],
              description: 'Array of existing catalog item IDs in the pack to avoid duplicates',
            }),
          }),
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
              id: z.number(),
              name: z.string(),
              weight: z.number().nullable(),
              weightUnit: z.string().nullable(),
              images: z.array(z.string()).nullable(),
              categories: z.array(z.string()).nullable(),
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
  const { existingCatalogItemIds } = await c.req.json();

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

  const firstEmbedding = existingEmbeddings[0];
  if (!firstEmbedding) {
    return c.json({ error: 'No valid embeddings found' }, 400);
  }

  const avgEmbedding = firstEmbedding.map(
    (_, i) =>
      existingEmbeddings.reduce((sum, emb) => sum + (emb?.[i] ?? 0), 0) / existingEmbeddings.length,
  );

  const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, avgEmbedding)})`;

  const whereConditions = [gt(similarity, 0.1)];
  if (existingCatalogItemIds.length > 0) {
    whereConditions.push(notInArray(catalogItems.id, existingCatalogItemIds));
  }

  const similarItems = await db
    .select({
      id: catalogItems.id,
      name: catalogItems.name,
      images: catalogItems.images,
      categories: catalogItems.categories,
      weight: catalogItems.weight,
      weightUnit: catalogItems.weightUnit,
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

    // Add updatedAt field (using createdAt as fallback since table doesn't have updatedAt)
    const entryWithUpdatedAt = packWeightHistoryEntry.map((entry) => ({
      ...entry,
      updatedAt: entry.createdAt,
    }));

    return c.json(entryWithUpdatedAt, 200);
  } catch (error) {
    console.error('Pack weight history API error:', error);
    return c.json({ error: 'Failed to create weight history entry' }, 500);
  }
});

export { packRoutes };

const gapAnalysisRoute = createRoute({
  method: 'post',
  path: '/{packId}/gap-analysis',
  tags: ['Packs'],
  summary: 'Analyze gear gaps in pack',
  description:
    'Use AI to analyze the pack contents and identify missing gear based on trip context and destination',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      packId: z.string().openapi({ example: 'p_123456' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: GapAnalysisRequestSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: 'Gap analysis completed successfully',
      content: {
        'application/json': {
          schema: GapAnalysisResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request - invalid pack or insufficient data',
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
    403: {
      description: 'Forbidden',
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

packRoutes.openapi(gapAnalysisRoute, async (c) => {
  const auth = c.get('user');
  const packId = c.req.param('packId');
  const { WeatherService } = await import('@packrat/api/services/weatherService');
  const weatherService = new WeatherService(c);

  try {
    const body = await c.req.json().catch(() => ({}));
    const { destination, tripType, duration, startDate, endDate } = body;

    // Get pack details with items
    const packDetails = await getPackDetails({ packId, c });
    if (!packDetails) {
      return c.json({ error: 'Pack not found' }, 404);
    }

    const pack = computePackWeights(packDetails);

    // Check if pack belongs to user
    const isOwned = pack.userId === auth.userId;
    if (!isOwned) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!pack.items || pack.items.length === 0) {
      return c.json({ error: 'Pack has no items to analyze' }, 400);
    }

    // Build context for AI analysis - context data to be used in prompt
    // Data is embedded directly in the prompt below

    // Get weather context if location provided
    let weatherContext = '';
    if (destination) {
      try {
        const weatherResult = await weatherService.getWeatherForLocation(destination);
        weatherContext = `Current weather in ${destination}: ${JSON.stringify(weatherResult)}`;
      } catch (error) {
        console.warn('Weather lookup failed:', error);
      }
    }

    // Prepare the gap analysis prompt
    const gapAnalysisPrompt = `
You are analyzing a hiking pack for gear gaps. Based on the pack contents and context, identify missing items that could improve safety, comfort, or preparedness.

Pack Details:
- Name: ${pack.name}
- Category: ${pack.category || 'General'}
- Description: ${pack.description || 'No description'}
- Tags: ${pack.tags?.join(', ') || 'None'}
- Total Weight: ${pack.totalWeight || 0}g
- Base Weight: ${pack.baseWeight || 0}g
- Item Count: ${pack.items.length}

Trip Context:
- Destination: ${destination || 'Not specified'} 
- Trip Type: ${tripType || 'Not specified'}
- Duration: ${duration || 'Not specified'}
- Start Date: ${startDate || 'Not specified'}
- End Date: ${endDate || 'Not specified'}

${weatherContext}

Current Items in Pack:
${pack.items
        .map(
          (item) =>
            `- ${item.name} (${item.category || 'Uncategorized'}, ${item.weight}g, qty: ${item.quantity}${item.worn ? ', worn' : ''}${item.consumable ? ', consumable' : ''})`,
        )
        .join('\n')}

Categories represented: ${Array.from(new Set(pack.items.map((item) => item.category).filter(Boolean))).join(', ')}

Analyze this pack and return a JSON response with the following structure:
{
  "gaps": [
    {
      "suggestion": "Item name",
      "reason": "Detailed explanation of why this item is recommended",
      "consumable": true|false,
      "worn": true|false,
      "priority": "must-have|nice-to-have|optional"
    }
  ],
  "summary": "Brief overall assessment of the pack's preparedness"
}

Focus on:
1. Safety essentials (first aid, navigation, emergency shelter)
2. Weather protection appropriate for the conditions and season 
3. Basic comfort items for the trip duration
4. Food and water considerations 
5. Trip-specific gear based on destination and activity type

Limit to maximum 6 recommendations, prioritizing the most important gaps. Only suggest items that are truly missing or inadequate for the described conditions.`;

    // Call the AI for gap analysis
    const { createAIProvider } = await import('@packrat/api/utils/ai/provider');
    const { generateObject } = await import('ai');
    const { getEnv } = await import('@packrat/api/utils/env-validation');
    const { DEFAULT_MODELS } = await import('@packrat/api/utils/ai/models');

    const { AI_PROVIDER, OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
      getEnv(c);

    const aiProvider = createAIProvider({
      openAiApiKey: OPENAI_API_KEY,
      provider: AI_PROVIDER,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareAiBinding: AI,
    });

    if (!aiProvider) {
      return c.json({ error: 'AI provider not configured' }, 500);
    }

    const result = await generateObject({
      model: aiProvider(DEFAULT_MODELS.OPENAI_CHAT),
      prompt: gapAnalysisPrompt,
      schema: z.object({
        gaps: z.array(
          z.object({
            suggestion: z.string(),
            reason: z.string(),
            consumable: z.boolean(),
            worn: z.boolean(),
            priority: z.enum(['must-have', 'nice-to-have', 'optional']).optional(),
          }),
        ),
        summary: z.string().optional(),
      }),
      temperature: 0.3, // Lower temperature for more consistent analysis
    });

    return c.json(result.object, 200);
  } catch (error) {
    console.error('Gap analysis error:', error);
    c.get('sentry')?.setTag('location', 'gap-analysis');
    c.get('sentry')?.setContext('meta', { packId });
    c.get('sentry')?.captureException(error);
    throw error;
  }
});
