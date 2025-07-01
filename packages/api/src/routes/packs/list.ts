import { createDb } from '@packrat/api/db';
import { packItems, packs, packWeightHistory } from '@packrat/api/db/schema';
import {
  authenticateRequest,
  unauthorizedResponse,
} from '@packrat/api/utils/api-middleware';
import { computePacksWeights } from '@packrat/api/utils/compute-pack';
import { and, eq, or } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const packsListRoutes = new OpenAPIHono();

const listGetRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      includePublic: z.coerce
        .number()
        .int()
        .min(0)
        .max(1)
        .optional()
        .default(0),
    }),
  },
  responses: { 200: { description: 'Get user packs' } },
});

packsListRoutes.openapi(listGetRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const { includePublic } = c.req.valid('query');
  const includePublicBool = Boolean(includePublic).valueOf();

  const db = createDb(c);
  const where = includePublicBool
    ? and(
        or(eq(packs.userId, auth.userId), eq(packs.isPublic, true)),
        eq(packs.deleted, false)
      )
    : eq(packs.userId, auth.userId);

  const result = await db.query.packs.findMany({
    where,
    with: {
      items: includePublicBool ? { where: eq(packItems.deleted, false) } : true,
    },
  });

  return c.json(computePacksWeights(result));
});

const listPostRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: z.any() } } } },
  responses: { 200: { description: 'Create pack' } },
});

packsListRoutes.openapi(listPostRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

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

  const packWithWeights = computePacksWeights([{ ...newPack, items: [] }])[0];
  return c.json(packWithWeights);
});

const weightHistoryRoute = createRoute({
  method: 'get',
  path: '/weight-history',
  responses: { 200: { description: 'Get weight history' } },
});

packsListRoutes.openapi(weightHistoryRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const userPackWeightHistories = await db.query.packWeightHistory.findMany({
    where: eq(packWeightHistory.userId, auth.userId),
  });

  return c.json(userPackWeightHistories);
});

export { packsListRoutes };
