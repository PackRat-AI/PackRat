import { createDb } from "@/db";
import { packTemplateItems, packTemplates } from "@/db/schema";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

const packTemplateItemsRoutes = new Hono();

// Get all items for a template
packTemplateItemsRoutes.get("/:templateId/items", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param("templateId");

  const items = await db.query.packTemplateItems.findMany({
    where: eq(packTemplateItems.packTemplateId, templateId),
  });

  return c.json(items);
});

// Add item to template
packTemplateItemsRoutes.post("/:templateId/items", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param("templateId");
  const data = await c.req.json();

  const [newItem] = await db
    .insert(packTemplateItems)
    .values({
      id: data.id,
      packTemplateId: templateId,
      name: data.name,
      description: data.description,
      weight: data.weight,
      weightUnit: data.weightUnit,
      quantity: data.quantity,
      category: data.category,
      consumable: data.consumable,
      worn: data.worn,
      image: data.image,
      notes: data.notes,
      userId: auth.userId,
    })

    .returning();

  await db
    .update(packTemplates)
    .set({ updatedAt: new Date() })
    .where(eq(packTemplates.id, templateId));

  return c.json(newItem);
});

// Update a template item
packTemplateItemsRoutes.patch("/items/:itemId", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const itemId = c.req.param("itemId");
  const data = await c.req.json();

  const [updatedItem] = await db
    .update(packTemplateItems)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(packTemplateItems.id, itemId),
        eq(packTemplateItems.userId, auth.userId),
      ),
    )
    .returning();

  if (!updatedItem) return c.json({ error: "Item not found" }, 404);

  return c.json(updatedItem);
});

export { packTemplateItemsRoutes };
