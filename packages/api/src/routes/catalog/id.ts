import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb } from "@packrat/api/db";
import { catalogItems } from "@packrat/api/db/schema";
import { generateEmbedding } from "@packrat/api/services/embeddingService";
import { Env } from "@packrat/api/types/env";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@packrat/api/utils/api-middleware";
import { getEmbeddingText } from "@packrat/api/utils/embeddingHelper";
import { eq } from "drizzle-orm";
import { env } from "hono/adapter";

const catalogItemRoutes = new OpenAPIHono();

// Get catalog item by ID
const getItemRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: { 200: { description: "Get catalog item" } },
});

catalogItemRoutes.openapi(getItemRoute, async (c) => {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(c);
    if (!auth) {
      return unauthorizedResponse();
    }

    const db = createDb(c);
    const itemId = Number(c.req.param("id"));

    const item = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, itemId),
    });

    if (!item) {
      return c.json({ error: "Catalog item not found" }, 404);
    }

    return c.json(item);
  } catch (error) {
    console.error("Error fetching catalog item:", error);
    return c.json({ error: "Failed to fetch catalog item" }, 500);
  }
});

// Update catalog item
const updateItemRoute = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.any() } },
    },
  },
  responses: { 200: { description: "Update catalog item" } },
});

catalogItemRoutes.openapi(updateItemRoute, async (c) => {
  try {
    // Only admins should be able to update catalog items
    const auth = await authenticateRequest(c);
    if (!auth) {
      return unauthorizedResponse();
    }

    const db = createDb(c);
    const itemId = Number(c.req.param("id"));
    const data = await c.req.json();
    const { OPENAI_API_KEY } = env<Env>(c);

    if (!OPENAI_API_KEY) {
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    const existingItem = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, itemId),
    });

    if (!existingItem) {
      return c.json({ error: "Catalog item not found" }, 404);
    }

    // Only generate a new embedding if the text has changed
    let embedding: number[] | undefined = undefined;
    const newEmbeddingText = getEmbeddingText(data, existingItem);
    const oldEmbeddingText = getEmbeddingText(existingItem);

    if (newEmbeddingText !== oldEmbeddingText) {
      embedding = await generateEmbedding({
        openAiApiKey: OPENAI_API_KEY,
        value: newEmbeddingText,
      });
    }

    const updateData: Partial<typeof catalogItems.$inferInsert> = { ...data };
    if (embedding) {
      updateData.embedding = embedding;
    }
    updateData.updatedAt = new Date();

    // Update the catalog item
    const [updatedItem] = await db
      .update(catalogItems)
      .set(updateData)
      .where(eq(catalogItems.id, itemId))
      .returning();

    return c.json(updatedItem);
  } catch (error) {
    console.error("Error updating catalog item:", error);
    return c.json({ error: "Failed to update catalog item" }, 500);
  }
});

// Delete catalog item
const deleteItemRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Delete catalog item" } },
});

catalogItemRoutes.openapi(deleteItemRoute, async (c) => {
  try {
    // Only admins should be able to delete catalog items
    const auth = await authenticateRequest(c);
    if (!auth) {
      return unauthorizedResponse();
    }

    const db = createDb(c);
    const itemId = Number(c.req.param("id"));

    // Check if the catalog item exists
    const existingItem = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, itemId),
    });

    if (!existingItem) {
      return c.json({ error: "Catalog item not found" }, 404);
    }

    // Delete the catalog item
    await db.delete(catalogItems).where(eq(catalogItems.id, itemId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting catalog item:", error);
    return c.json({ error: "Failed to delete catalog item" }, 500);
  }
});

export { catalogItemRoutes };
