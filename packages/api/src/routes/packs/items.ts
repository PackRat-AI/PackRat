import { createDb } from "@/db";
import { packItems, packs, packWeightHistory } from "@/db/schema";
import { Env } from "@/types/env";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { convertToGrams } from "@/utils/weight";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { env } from "hono/adapter";

const packItemsRoutes = new OpenAPIHono();

// Get all items for a pack
const getItemsRoute = createRoute({
  method: 'get',
  path: '/{packId}/items',
  request: { params: z.object({ packId: z.string() }) },
  responses: { 200: { description: 'Get pack items' } },
});

packItemsRoutes.openapi(getItemsRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  try {
    const packId = c.req.param("packId");
    const items = await db.query.packItems.findMany({
      where: eq(packItems.packId, packId),
      with: {
        catalogItem: true,
      },
    });
    return c.json(items);
  } catch (error) {
    console.error("Error fetching pack items:", error);
    return c.json({ error: "Failed to fetch pack items" }, 500);
  }
});

// Get pack item by ID
const getItemRoute = createRoute({
  method: 'get',
  path: '/items/{itemId}',
  request: { params: z.object({ itemId: z.string() }) },
  responses: { 200: { description: 'Get pack item' } },
});

packItemsRoutes.openapi(getItemRoute, async (c) => {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(c);
    if (!auth) {
      return unauthorizedResponse();
    }

    const db = createDb(c);
    const userId = auth.userId;
    const itemId = c.req.param("itemId");

    // Get the item
    const item = await db.query.packItems.findFirst({
      where: and(
        eq(packItems.id, itemId),
        eq(packItems.userId, Number(userId)),
      ),
      with: {
        catalogItem: true,
      },
    });

    if (!item) {
      return c.json({ error: "Item not found" }, { status: 404 });
    }

    return c.json(item);
  } catch (error) {
    console.error("Error fetching pack item:", error);
    return c.json({ error: "Failed to fetch pack item" }, { status: 500 });
  }
});

// Add an item to a pack
const addItemRoute = createRoute({
  method: 'post',
  path: '/{packId}/items',
  request: {
    params: z.object({ packId: z.string() }),
    body: { content: { 'application/json': { schema: z.any() } } },
  },
  responses: { 200: { description: 'Add item to pack' } },
});

packItemsRoutes.openapi(addItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  try {
    const packId = c.req.param("packId");
    const data = await c.req.json();

    if (!packId) {
      return c.json({ error: "Pack ID is required" }, 400);
    }

    if (!data.id) {
      return c.json({ error: "Item ID is required" }, 400);
    }

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
      })
      .returning();

    await db
      .update(packs)
      .set({ updatedAt: new Date() })
      .where(eq(packs.id, packId));

    return c.json(newItem);
  } catch (error) {
    console.error("Error adding pack item:", error);
    return c.json({ error: "Failed to add pack item" }, 500);
  }
});

// Update a pack item
const updateItemRoute = createRoute({
  method: 'patch',
  path: '/items/{itemId}',
  request: {
    params: z.object({ itemId: z.string() }),
    body: { content: { 'application/json': { schema: z.any() } } },
  },
  responses: { 200: { description: 'Update pack item' } },
});

packItemsRoutes.openapi(updateItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  try {
    const itemId = c.req.param("itemId");
    const data = await c.req.json();

    const updateData: Partial<typeof packItems.$inferInsert> = {};

    if ("name" in data) updateData.name = data.name;
    if ("description" in data) updateData.description = data.description;
    if ("weight" in data) updateData.weight = data.weight;
    if ("weightUnit" in data) updateData.weightUnit = data.weightUnit;
    if ("quantity" in data) updateData.quantity = data.quantity;
    if ("category" in data) updateData.category = data.category;
    if ("consumable" in data) updateData.consumable = data.consumable;
    if ("worn" in data) updateData.worn = data.worn;
    if ("image" in data) updateData.image = data.image;
    if ("notes" in data) updateData.notes = data.notes;
    if ("deleted" in data) updateData.deleted = data.deleted;

    updateData.updatedAt = new Date();

    // Delete old image from R2 if we are changing image
    if ("image" in data) {
      try {
        const item = await db.query.packItems.findFirst({
          where: and(
            eq(packItems.id, itemId),
            eq(packItems.userId, auth.userId),
          ),
        });
        if (!item) {
          return c.json({ error: "Pack item not found" }, 404);
        }
        const oldImage = item.image;

        // Nothing to delete if old image is null
        if (oldImage) {
          const {
            R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY,
            CLOUDFLARE_ACCOUNT_ID,
            R2_BUCKET_NAME,
          } = env<Env>(c);

          const s3Client = new S3Client({
            region: "auto",
            endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId: R2_ACCESS_KEY_ID || "",
              secretAccessKey: R2_SECRET_ACCESS_KEY || "",
            },
          });

          const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: oldImage,
          });

          await s3Client.send(command);
        }
      } catch {
        // Silently fail because this op shouldn't prevent the update
      }
    }

    const [updatedItem] = await db
      .update(packItems)
      .set(updateData)
      .where(and(eq(packItems.id, itemId), eq(packItems.userId, auth.userId)))
      .returning();

    if (!updatedItem) {
      return c.json({ error: "Pack item not found" }, 404);
    }

    // Update the pack's updatedAt timestamp
    await db
      .update(packs)
      .set({ updatedAt: new Date() })
      .where(eq(packs.id, updatedItem.packId));

    return c.json(updatedItem);
  } catch (error) {
    console.error("Error updating pack item:", error);
    return c.json({ error: "Failed to update pack item" }, 500);
  }
});

export { packItemsRoutes };
