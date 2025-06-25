import { createDb } from "@packrat/api/db";
import { packs, packWeightHistory } from "@packrat/api/db/schema";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@packrat/api/utils/api-middleware";
import { computePacksWeights } from "@packrat/api/utils/compute-pack";
import { eq, or, and, ne } from "drizzle-orm";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const packsListRoutes = new OpenAPIHono();

async function getPacks({
  db,
  userId,
  includePublic = false,
}: {
  db: ReturnType<typeof createDb>;
  userId: number;
  includePublic?: boolean;
}) {
  const where = includePublic
    ? or(
        eq(packs.userId, userId),
        and(ne(packs.userId, userId), eq(packs.isPublic, true)),
      )
    : eq(packs.userId, userId);

  const result = await db.query.packs.findMany({
    where,
    with: { items: true },
  });

  return computePacksWeights(result);
}

const allPacksRoute = createRoute({
  method: "get",
  path: "/all",
  responses: { 200: { description: "Get all user + public packs" } },
});

packsListRoutes.openapi(allPacksRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const result = await getPacks({
    db,
    userId: auth.userId,
    includePublic: true,
  });

  return c.json(result);
});

const listGetRoute = createRoute({
  method: "get",
  path: "/",
  responses: { 200: { description: "Get user packs" } },
});

packsListRoutes.openapi(listGetRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const result = await getPacks({ db, userId: auth.userId });

  return c.json(result);
});

const listPostRoute = createRoute({
  method: "post",
  path: "/",
  request: { body: { content: { "application/json": { schema: z.any() } } } },
  responses: { 200: { description: "Create pack" } },
});

packsListRoutes.openapi(listPostRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const data = await c.req.json();

  // Ensure the client provides an ID
  if (!data.id) {
    return c.json({ error: "Pack ID is required" }, 400);
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
  method: "get",
  path: "/weight-history",
  responses: { 200: { description: "Get weight history" } },
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
