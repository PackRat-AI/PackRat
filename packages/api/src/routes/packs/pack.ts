import { createDb } from "@/db";
import { packs, packWeightHistory, type PackWithItems } from '@/db/schema';
import {
  authenticateRequest,
  unauthorizedResponse,
} from '@/utils/api-middleware';
import { computePackWeights } from '@/utils/compute-pack';
import { getCatalogItems, getPackDetails } from '@/utils/DbUtils';
import { and, eq } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const packRoutes = new OpenAPIHono();

// Get a specific pack
const getPackRoute = createRoute({
  method: 'get',
  path: '/{packId}',
  request: {
    params: z.object({ packId: z.string() }),
  },
  responses: { 200: { description: 'Get pack' } },
});

packRoutes.openapi(getPackRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    const pack = await db.query.packs.findFirst({
      where: eq(packs.id, packId),
      with: {
        items: true,
      },
    });

    if (!pack) {
      return c.json({ error: 'Pack not found' }, 404);
    }
    return c.json(pack);
  } catch (error) {
    console.error('Error fetching pack:', error);
    return c.json({ error: 'Failed to fetch pack' }, 500);
  }
});

// Update a pack
const updatePackRoute = createRoute({
  method: 'put',
  path: '/{packId}',
  request: {
    params: z.object({ packId: z.string() }),
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: { 200: { description: 'Update pack' } },
});

packRoutes.openapi(updatePackRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    const data = await c.req.json();
    
    // Create update object with only the provided fields
    const updateData: Record<string, any> = {};
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

    const updatedPack: PackWithItems | undefined =
      await db.query.packs.findFirst({
        where: and(eq(packs.id, packId), eq(packs.userId, auth.userId)),
        with: {
          items: true,
        },
      });

    if (!updatedPack) {
      return c.json({ error: 'Pack not found' }, 404);
    }

    const packWithWeights = computePackWeights(updatedPack);
    return c.json(packWithWeights);
  } catch (error) {
    console.error('Error updating pack:', error);
    return c.json({ error: 'Failed to update pack' }, 500);
  }
});

// Delete a pack
const deletePackRoute = createRoute({
  method: 'delete',
  path: '/{packId}',
  request: { params: z.object({ packId: z.string() }) },
  responses: { 200: { description: 'Delete pack' } },
});

packRoutes.openapi(deletePackRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
    const packId = c.req.param('packId');
    await db.delete(packs).where(eq(packs.id, packId));
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting pack:', error);
    return c.json({ error: 'Failed to delete pack' }, 500);
  }
});

const itemSuggestionsRoute = createRoute({
  method: 'post',
  path: '/{packId}/item-suggestions',
  request: {
    params: z.object({ packId: z.string() }),
    body: { content: { 'application/json': { schema: z.any() } } },
  },
  responses: { 200: { description: 'Pack item suggestions' } },
});

packRoutes.openapi(itemSuggestionsRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const packId = c.req.param('packId');
    const { categories } = await c.req.json();

    // Get pack details
    const pack = await getPackDetails({ packId, c });
    if (!pack) {
      return c.json({ error: 'Pack not found' }, 404);
    }

    // Get catalog items that could be suggested
    const catalogItems = await getCatalogItems({ options: { categories }, c });

    // For now, let's implement a simple algorithm to suggest items
    // This avoids the AI complexity that's causing issues

    // Get existing categories and items in the pack
    const existingCategories = new Set(
      pack.items.map((item) => item.category || 'Uncategorized')
    );

    const existingItemNames = new Set(
      pack.items.map((item) => item.name.toLowerCase())
    );

    // Simple suggestion algorithm:
    // 1. Suggest items from categories not in the pack
    // 2. Suggest items that complement existing categories
    // 3. Don't suggest items with names already in the pack

    const suggestions = catalogItems.filter((item) => {
      // Don't suggest items already in the pack
      if (existingItemNames.has(item.name.toLowerCase())) {
        return false;
      }

      // Prioritize items from categories not in the pack
      if (item.category && !existingCategories.has(item.category)) {
        return true;
      }

      // Include some items from existing categories (complementary items)
      return Math.random() > 0.7; // Random selection for variety
    });

    // Limit to 5 suggestions
    const limitedSuggestions = suggestions.slice(0, 5);

    return c.json(limitedSuggestions);
  } catch (error) {
    console.error('Pack Item Suggestions API error:', error);
    return c.json({ error: 'Failed to process item suggestions request' }, 500);
  }
});

const weightHistoryRoute = createRoute({
  method: 'post',
  path: '/{packId}/weight-history',
  request: {
    params: z.object({ packId: z.string() }),
    body: { content: { 'application/json': { schema: z.any() } } },
  },
  responses: { 200: { description: 'Create pack weight history' } },
});

packRoutes.openapi(weightHistoryRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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

    return c.json(packWeightHistoryEntry);
  } catch (error) {
    console.error('Pack weight history API error:', error);
    return c.json({ error: 'Failed to create weight history entry' }, 500);
  }
});


export { packRoutes };
