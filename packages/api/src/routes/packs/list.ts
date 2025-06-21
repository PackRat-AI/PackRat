import { createDb } from "@/db";
import { packs, packWeightHistory } from '@/db/schema';
import {
  authenticateRequest,
  unauthorizedResponse,
} from '@/utils/api-middleware';
import { computePacksWeights } from '@/utils/compute-pack';
import { eq } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const packsListRoutes = new OpenAPIHono();

// Get all packs for the user
const listGetRoute = createRoute({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Get user packs' } },
});

packsListRoutes.openapi(listGetRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
    const userPacks = await db.query.packs.findMany({
      where: eq(packs.userId, auth.userId),
      with: {
        items: true,
      },
    });

    const packsWithWeights = computePacksWeights(userPacks);
    return c.json(packsWithWeights);
  } catch (error) {
    console.error('Error fetching packs:', error);
    return c.json({ error: 'Failed to fetch packs' }, 500);
  }
});

// Create a new pack
const listPostRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Create pack' } },
});

packsListRoutes.openapi(listPostRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
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

    const packWithWeights = computePacksWeights([{ ...newPack, items: [] }])[0];
    return c.json(packWithWeights);
  } catch (error) {
    console.error('Error creating pack:', error);
    return c.json({ error: 'Failed to create pack' }, 500);
  }
});

const weightHistoryRoute = createRoute({
  method: 'get',
  path: '/weight-history',
  responses: { 200: { description: 'Get weight history' } },
});

packsListRoutes.openapi(weightHistoryRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
    const userPackWeightHistories = await db.query.packWeightHistory.findMany({
      where: eq(packWeightHistory.userId, auth.userId),
    });

    return c.json(userPackWeightHistories);
  } catch (error) {
    console.error('Error fetching weight histories:', error);
    return c.json({ error: 'Failed to fetch weight histories' }, 500);
  }
});

export { packsListRoutes };
