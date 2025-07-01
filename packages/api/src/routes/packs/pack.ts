import { createDb } from '@packrat/api/db';
import { catalogItems, packs, packWeightHistory, type PackWithItems } from '@packrat/api/db/schema';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { computePackWeights } from '@packrat/api/utils/compute-pack';
import { getPackDetails } from '@packrat/api/utils/DbUtils';
import { and, eq, cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { env } from 'hono/adapter';
import { Env } from '@packrat/api/types/env';

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

  const db = createDb(c);
  const packId = c.req.param('packId');

  try {
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
      (_, i) =>
        existingEmbeddings.reduce((sum, emb) => sum + emb[i], 0) / existingEmbeddings.length,
    );

    const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, avgEmbedding)})`;

    const existingCatalogIds = new Set(
      pack.items.map((item) => item.catalogItemId).filter(Boolean),
    );

    const excludeCondition = existingCatalogIds.size
      ? sql`NOT (${catalogItems.id} = ANY(${Array.from(existingCatalogIds)}))`
      : sql`TRUE`;

    const similarItems = await db
      .select({
        id: catalogItems.id,
        name: catalogItems.name,
        image: catalogItems.image,
        category: catalogItems.category,
        similarity,
      })
      .from(catalogItems)
      .where(and(gt(similarity, 0.1), excludeCondition))
      .orderBy(desc(similarity))
      .limit(5);

    return c.json(similarItems);
  } catch (error) {
    return c.json({ error: 'Failed to compute item suggestions' }, 500);
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
