import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createDb } from '@packrat/api/db';
import {
  catalogItems,
  type NewPack,
  type NewPackItem,
  type PackWithItems,
  packItems,
  packs,
  packWeightHistory,
} from '@packrat/api/db/schema';
import { adminAuthPlugin, authPlugin } from '@packrat/api/middleware/auth';
import { AnalyzeImageRequestSchema } from '@packrat/api/schemas/imageDetection';
import {
  CreatePackItemRequestSchema,
  CreatePackRequestSchema,
  GapAnalysisRequestSchema,
  UpdatePackItemRequestSchema,
  UpdatePackRequestSchema,
} from '@packrat/api/schemas/packs';
import { ImageDetectionService, PackService } from '@packrat/api/services';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import { computePacksWeights, computePackWeights } from '@packrat/api/utils/compute-pack';
import { getPackDetails } from '@packrat/api/utils/DbUtils';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';
import { getPresignedUrl } from '@packrat/api/utils/getPresignedUrl';
import {
  and,
  cosineDistance,
  desc,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const CreatePackBodySchema = CreatePackRequestSchema.extend({
  id: z.string(),
  localCreatedAt: z.string(),
  localUpdatedAt: z.string(),
});

const AddPackItemBodySchema = CreatePackItemRequestSchema.extend({
  id: z.string(),
});

export const packsRoutes = new Elysia({ prefix: '/packs' })
  .use(authPlugin)
  .use(adminAuthPlugin)

  // List packs
  .get(
    '/',
    async ({ query, user }) => {
      const includePublic = Number(query.includePublic ?? 0) === 1;
      const db = createDb();

      const where = includePublic
        ? and(or(eq(packs.userId, user.userId), eq(packs.isPublic, true)), eq(packs.deleted, false))
        : eq(packs.userId, user.userId);

      const result = await db.query.packs.findMany({
        where,
        with: {
          items: includePublic ? { where: eq(packItems.deleted, false) } : true,
        },
      });

      return computePacksWeights(result);
    },
    {
      query: z.object({
        includePublic: z.coerce.number().int().min(0).max(1).optional().default(0),
      }),
      isAuthenticated: true,
      detail: { tags: ['Packs'], summary: 'List user packs', security: [{ bearerAuth: [] }] },
    },
  )

  // Create pack
  .post(
    '/',
    async ({ body, user }) => {
      const db = createDb();
      const data = body;

      const packId = data.id as string;
      if (!packId) return status(400, { error: 'Pack ID is required' });

      // Zod validates all fields at runtime; cast through the Standard Schema
      // inference gap so drizzle's insert accepts the values.
      const [newPack] = await db
        .insert(packs)
        .values({
          id: packId,
          userId: user.userId,
          name: data.name,
          description: data.description,
          category: data.category,
          isPublic: data.isPublic,
          image: data.image,
          tags: data.tags,
          localCreatedAt: new Date(data.localCreatedAt as string),
          localUpdatedAt: new Date(data.localUpdatedAt as string),
        } as typeof packs.$inferInsert)
        .returning();

      if (!newPack) return status(400, { error: 'Failed to create pack' });

      const packWithItems: PackWithItems = { ...newPack, items: [] };
      return computePacksWeights([packWithItems])[0];
    },
    {
      body: CreatePackBodySchema,
      isAuthenticated: true,
      detail: { tags: ['Packs'], summary: 'Create new pack', security: [{ bearerAuth: [] }] },
    },
  )

  // Weight history
  .get(
    '/weight-history',
    async ({ user }) => {
      const db = createDb();
      const histories = await db.query.packWeightHistory.findMany({
        where: eq(packWeightHistory.userId, user.userId),
      });

      return histories.map((history) => ({
        ...history,
        updatedAt: history.createdAt,
      }));
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Packs'],
        summary: 'Get user weight history',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Generate packs (admin only)
  .post(
    '/generate-packs',
    async ({ body, user }) => {
      const packService = new PackService(user.userId);
      return packService.generatePacks(body.count);
    },
    {
      body: z.object({ count: z.number().int().positive().default(1) }),
      isAdmin: true,
      detail: {
        tags: ['Packs'],
        summary: 'Generate sample packs (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Analyze image
  .post(
    '/analyze-image',
    async ({ body, user }) => {
      try {
        const { image, matchLimit } = body;

        if (!image.startsWith(`${user.userId}-`)) {
          return status(403, { error: 'Unauthorized' });
        }

        const { PACKRAT_BUCKET_R2_BUCKET_NAME, PACKRAT_BUCKET } = getEnv();
        const command = new GetObjectCommand({
          Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
          Key: image,
        });
        const imageUrl = await getPresignedUrl({
          command,
          signOptions: { expiresIn: 3600 },
        });

        const imageDetectionService = new ImageDetectionService();
        const result = await imageDetectionService.detectAndMatchItems(imageUrl, matchLimit);

        await PACKRAT_BUCKET.delete(image);

        return result;
      } catch (error) {
        console.error('Error analyzing image:', error);
        if (error instanceof Error) {
          if (
            error.message.includes('Invalid image') ||
            error.message.includes('Unsupported image format') ||
            error.message.includes('Image too large')
          ) {
            return status(400, { error: error.message });
          }
          return status(500, { error: `Failed to analyze image: ${error.message}` });
        }
        return status(500, { error: 'Failed to analyze image' });
      }
    },
    {
      body: AnalyzeImageRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Packs'],
        summary: 'Analyze image to detect gear items',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Get pack by ID
  .get(
    '/:packId',
    async ({ params }) => {
      const db = createDb();
      try {
        const pack = await db.query.packs.findFirst({
          where: eq(packs.id, params.packId),
          with: { items: { where: eq(packItems.deleted, false) } },
        });

        if (!pack) return status(404, { error: 'Pack not found' });
        return computePackWeights(pack);
      } catch (error) {
        console.error('Error fetching pack:', error);
        return status(500, { error: 'Failed to fetch pack' });
      }
    },
    {
      params: z.object({ packId: z.string() }),
      isAuthenticated: true,
      detail: { tags: ['Packs'], summary: 'Get pack by ID', security: [{ bearerAuth: [] }] },
    },
  )

  // Update pack
  .put(
    '/:packId',
    async ({ params, body, user }) => {
      const db = createDb();
      try {
        const data = body;

        const updateData: Partial<NewPack> = {};
        if ('name' in data && data.name !== undefined) updateData.name = data.name;
        if ('description' in data) updateData.description = data.description;
        if ('category' in data) updateData.category = data.category;
        if ('isPublic' in data) updateData.isPublic = data.isPublic;
        if ('image' in data) updateData.image = data.image;
        if ('tags' in data) updateData.tags = data.tags;
        if ('deleted' in data) updateData.deleted = data.deleted;
        if ('localUpdatedAt' in data && data.localUpdatedAt)
          updateData.localUpdatedAt = new Date(data.localUpdatedAt);

        updateData.updatedAt = new Date();

        await db
          .update(packs)
          .set(updateData)
          .where(and(eq(packs.id, params.packId), eq(packs.userId, user.userId)));

        const updatedPack: PackWithItems | undefined = await db.query.packs.findFirst({
          where: and(eq(packs.id, params.packId), eq(packs.userId, user.userId)),
          with: { items: true },
        });

        if (!updatedPack) return status(404, { error: 'Pack not found' });
        return computePackWeights(updatedPack);
      } catch (error) {
        console.error('Error updating pack:', error);
        return status(500, { error: 'Failed to update pack' });
      }
    },
    {
      params: z.object({ packId: z.string() }),
      body: UpdatePackRequestSchema.extend({
        localUpdatedAt: z.string().datetime().optional(),
      }),
      isAuthenticated: true,
      detail: { tags: ['Packs'], summary: 'Update pack', security: [{ bearerAuth: [] }] },
    },
  )

  // Delete pack
  .delete(
    '/:packId',
    async ({ params, user }) => {
      const db = createDb();

      const pack = await db.query.packs.findFirst({
        where: and(eq(packs.id, params.packId), eq(packs.userId, user.userId)),
      });

      if (!pack) return status(404, { error: 'Pack not found' });

      await db.delete(packs).where(and(eq(packs.id, params.packId), eq(packs.userId, user.userId)));
      return { success: true };
    },
    {
      params: z.object({ packId: z.string() }),
      isAuthenticated: true,
      detail: { tags: ['Packs'], summary: 'Delete pack', security: [{ bearerAuth: [] }] },
    },
  )

  // Item suggestions
  .post(
    '/:packId/item-suggestions',
    async ({ params, body }) => {
      const db = createDb();
      const { existingCatalogItemIds } = body;

      const pack = await getPackDetails({ packId: params.packId });
      if (!pack) return status(404, { error: 'Pack not found' });

      const existingEmbeddings = pack.items
        .map((item) => item.embedding)
        .filter((e): e is number[] => Array.isArray(e) && e.length > 0);

      if (existingEmbeddings.length === 0) {
        return status(400, { error: 'No embeddings found for existing items' });
      }

      const firstEmbedding = existingEmbeddings[0];
      if (!firstEmbedding) return status(400, { error: 'No valid embeddings found' });

      const avgEmbedding = firstEmbedding.map(
        (_, i) =>
          existingEmbeddings.reduce((sum, emb) => sum + (emb?.[i] ?? 0), 0) /
          existingEmbeddings.length,
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

      return similarItems;
    },
    {
      params: z.object({ packId: z.string() }),
      body: z.object({ existingCatalogItemIds: z.array(z.number()) }),
      isAuthenticated: true,
      detail: {
        tags: ['Packs'],
        summary: 'Get item suggestions for pack',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Weight history entry
  .post(
    '/:packId/weight-history',
    async ({ params, body, user }) => {
      const db = createDb();
      try {
        const data = body;
        const packWeightHistoryEntry = await db
          .insert(packWeightHistory)
          .values({
            id: data.id,
            packId: params.packId,
            userId: user.userId,
            weight: data.weight,
            localCreatedAt: new Date(data.localCreatedAt),
          })
          .returning();

        return packWeightHistoryEntry.map((entry) => ({
          ...entry,
          updatedAt: entry.createdAt,
        }));
      } catch (error) {
        console.error('Pack weight history API error:', error);
        return status(500, { error: 'Failed to create weight history entry' });
      }
    },
    {
      params: z.object({ packId: z.string() }),
      body: z.object({
        id: z.string(),
        weight: z.number(),
        localCreatedAt: z.string().datetime(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Packs'],
        summary: 'Create pack weight history entry',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Gap analysis
  .post(
    '/:packId/gap-analysis',
    async ({ params, body, user }) => {
      const { WeatherService } = await import('@packrat/api/services/weatherService');
      const weatherService = new WeatherService();

      try {
        const { destination, tripType, duration, startDate, endDate } = body ?? {};

        const packDetails = await getPackDetails({ packId: params.packId });
        if (!packDetails) return status(404, { error: 'Pack not found' });

        const pack = computePackWeights(packDetails);

        if (pack.userId !== user.userId) {
          return status(403, { error: 'Forbidden' });
        }

        if (!pack.items || pack.items.length === 0) {
          return status(400, { error: 'Pack has no items to analyze' });
        }

        let weatherContext = '';
        if (destination) {
          try {
            const weatherResult = await weatherService.getWeatherForLocation(destination);
            weatherContext = `Current weather in ${destination}: ${JSON.stringify(weatherResult)}`;
          } catch (error) {
            console.warn('Weather lookup failed:', error);
          }
        }

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

Limit to maximum 6 recommendations, prioritizing the most important gaps. Only suggest items that are truly missing or inadequate for the described conditions.`;

        const { createAIProvider } = await import('@packrat/api/utils/ai/provider');
        const { generateObject } = await import('ai');
        const { DEFAULT_MODELS } = await import('@packrat/api/utils/ai/models');

        const { AI_PROVIDER, OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
          getEnv();

        const aiProvider = createAIProvider({
          openAiApiKey: OPENAI_API_KEY,
          provider: AI_PROVIDER,
          cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
          cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
          cloudflareAiBinding: AI,
        });

        if (!aiProvider) return status(500, { error: 'AI provider not configured' });

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
          temperature: 0.3,
        });

        return result.object;
      } catch (error) {
        console.error('Gap analysis error:', error);
        throw error;
      }
    },
    {
      params: z.object({ packId: z.string() }),
      body: GapAnalysisRequestSchema.optional(),
      isAuthenticated: true,
      detail: {
        tags: ['Packs'],
        summary: 'Analyze gear gaps in pack',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Pack items
  .get(
    '/:packId/items',
    async ({ params, user }) => {
      const db = createDb();

      const pack = await db.query.packs.findFirst({
        where: eq(packs.id, params.packId),
        columns: { id: true, userId: true, isPublic: true },
      });

      if (!pack) return status(404, { error: 'Pack not found' });

      const canAccess = pack.isPublic || pack.userId === user.userId;
      if (!canAccess) return status(403, { error: 'Unauthorized' });

      const conditions = [eq(packItems.packId, params.packId)];
      if (pack.userId !== user.userId) {
        conditions.push(eq(packItems.deleted, false));
      }

      const items = await db.query.packItems.findMany({
        where: and(...conditions),
        with: { catalogItem: true },
      });

      return items.map((item) => ({
        ...item,
        consumable: item.consumable ?? false,
        worn: item.worn ?? false,
        deleted: item.deleted ?? false,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }));
    },
    {
      params: z.object({ packId: z.string() }),
      isAuthenticated: true,
      detail: { tags: ['Pack Items'], summary: 'Get pack items', security: [{ bearerAuth: [] }] },
    },
  )

  // Add item
  .post(
    '/:packId/items',
    async ({ params, body, user }) => {
      const db = createDb();
      const packId = params.packId;
      const data = body;
      const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
        getEnv();

      if (!OPENAI_API_KEY) return status(400, { error: 'OpenAI API key not configured' });
      if (!data.id) return status(400, { error: 'Item ID is required' });

      const embeddingText = getEmbeddingText(data);
      const embedding = await generateEmbedding({
        openAiApiKey: OPENAI_API_KEY,
        value: embeddingText,
        provider: AI_PROVIDER,
        cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
        cloudflareAiBinding: AI,
      });

      const [newItem] = await db
        .insert(packItems)
        .values({
          id: data.id,
          packId,
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
          userId: user.userId,
          embedding,
        } as NewPackItem)
        .returning();

      await db.update(packs).set({ updatedAt: new Date() }).where(eq(packs.id, packId));

      if (!newItem) return status(400, { error: 'Failed to create item' });

      return {
        ...newItem,
        consumable: newItem.consumable ?? false,
        worn: newItem.worn ?? false,
        deleted: newItem.deleted ?? false,
        createdAt: newItem.createdAt.toISOString(),
        updatedAt: newItem.updatedAt.toISOString(),
        embedding: undefined,
        templateItemId: newItem.templateItemId ?? null,
      };
    },
    {
      params: z.object({ packId: z.string() }),
      body: AddPackItemBodySchema,
      isAuthenticated: true,
      detail: { tags: ['Pack Items'], summary: 'Add item to pack', security: [{ bearerAuth: [] }] },
    },
  )

  // Get single item
  .get(
    '/items/:itemId',
    async ({ params, user }) => {
      const db = createDb();
      const item = await db.query.packItems.findFirst({
        where: eq(packItems.id, params.itemId),
        with: { catalogItem: true, pack: true },
      });

      if (!item) return status(404, { error: 'Item not found' });

      const isOwner = item.userId === user.userId;
      const isPublic = item.pack.isPublic;

      if (!isOwner && !isPublic) return status(403, { error: 'Unauthorized' });

      return item;
    },
    {
      params: z.object({ itemId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Items'],
        summary: 'Get pack item by ID',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update item
  .patch(
    '/items/:itemId',
    async ({ params, body, user }) => {
      const db = createDb();
      const itemId = params.itemId;
      const data = body;
      const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
        getEnv();

      if (!OPENAI_API_KEY) return status(500, { error: 'OpenAI API key not configured' });

      const existingItem = await db.query.packItems.findFirst({
        where: and(eq(packItems.id, itemId), eq(packItems.userId, user.userId)),
      });

      if (!existingItem) return status(404, { error: 'Pack item not found' });

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
          cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
          cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
          cloudflareAiBinding: AI,
        });
      }

      updateData.updatedAt = new Date();

      // Delete old image from R2 if changing image
      if ('image' in data) {
        try {
          const item = await db.query.packItems.findFirst({
            where: and(eq(packItems.id, itemId), eq(packItems.userId, user.userId)),
          });
          const oldImage = item?.image ?? null;
          if (oldImage) {
            const { PACKRAT_BUCKET } = getEnv();
            await PACKRAT_BUCKET.delete(oldImage);
          }
        } catch (error) {
          console.error('Error deleting old image from R2:', error);
        }
      }

      const [updatedItem] = await db
        .update(packItems)
        .set(updateData)
        .where(and(eq(packItems.id, itemId), eq(packItems.userId, user.userId)))
        .returning();

      if (!updatedItem) return status(404, { error: 'Pack item not found' });

      await db.update(packs).set({ updatedAt: new Date() }).where(eq(packs.id, updatedItem.packId));

      updatedItem.embedding = null;
      return updatedItem;
    },
    {
      params: z.object({ itemId: z.string() }),
      body: UpdatePackItemRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Pack Items'],
        summary: 'Update pack item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete item
  .delete(
    '/items/:itemId',
    async ({ params, user }) => {
      const db = createDb();
      const itemId = params.itemId;

      const item = await db.query.packItems.findFirst({
        where: and(eq(packItems.id, itemId), eq(packItems.userId, user.userId)),
      });

      if (!item) return status(404, { error: 'Pack item not found' });

      const packId = item.packId;
      await db.delete(packItems).where(eq(packItems.id, itemId));
      await db.update(packs).set({ updatedAt: new Date() }).where(eq(packs.id, packId));

      return { success: true, itemId };
    },
    {
      params: z.object({ itemId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Items'],
        summary: 'Delete pack item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Similar items for pack item
  .get(
    '/:packId/items/:itemId/similar',
    async ({ params, query, user }) => {
      const db = createDb();
      const { itemId } = params;
      const limit = query.limit ? Number(query.limit) : 5;
      const threshold = query.threshold ? Number(query.threshold) : 0.1;

      const validLimit = Math.min(Math.max(limit, 1), 20);

      const sourceItem = await db.query.packItems.findFirst({
        where: eq(packItems.id, itemId),
        with: { pack: true },
      });

      if (!sourceItem?.embedding) {
        return status(404, { error: 'Pack item not found or has no embedding' });
      }

      if (sourceItem.pack.userId !== user.userId && !sourceItem.pack.isPublic) {
        return status(403, { error: 'Access denied to private pack' });
      }

      const catalogSimilarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, sourceItem.embedding)})`;
      const { embedding: _catalogEmbedding, ...catalogColumns } = getTableColumns(catalogItems);

      const similarCatalogItems = await db
        .select({ ...catalogColumns, similarity: catalogSimilarity })
        .from(catalogItems)
        .where(and(gt(catalogSimilarity, threshold), isNotNull(catalogItems.embedding)))
        .orderBy(desc(catalogSimilarity))
        .limit(validLimit);

      const { embedding: _sourceEmbedding, ...sourceItemData } = sourceItem;

      return {
        items: similarCatalogItems,
        total: similarCatalogItems.length,
        sourceItem: sourceItemData,
      };
    },
    {
      params: z.object({ packId: z.string(), itemId: z.string() }),
      query: z.object({
        limit: z.string().optional(),
        threshold: z.string().optional(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Items'],
        summary: 'Get similar items to a pack item',
        security: [{ bearerAuth: [] }],
      },
    },
  );
