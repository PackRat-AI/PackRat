import { createDb } from "@/db";
import { packTemplates, type PackTemplateWithItems } from "@/db/schema";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

const packTemplateRoutes = new Hono();

// Get a specific pack template
packTemplateRoutes.get("/:templateId", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param("templateId");

  const template = await db.query.packTemplates.findFirst({
    where: eq(packTemplates.id, templateId),
    with: { items: true },
  });

  if (!template) return c.json({ error: "Template not found" }, 404);
  return c.json(template);
});

// Update a pack template
packTemplateRoutes.put("/:templateId", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param("templateId");
  const data = await c.req.json();

  const updateData: Record<string, any> = {};
  if ('name' in data) updateData.name = data.name;
  if ('description' in data) updateData.description = data.description;
  if ('category' in data) updateData.category = data.category;
  if ('image' in data) updateData.image = data.image;
  if ('tags' in data) updateData.tags = data.tags;
  if ('isFeatured' in data && auth.role === 'ADMIN')
    updateData.isFeatured = data.isFeatured;
  if ('deleted' in data) updateData.deleted = data.deleted;
  if ('localUpdatedAt' in data)
    updateData.localUpdatedAt = new Date(data.localUpdatedAt);

  await db
    .update(packTemplates)
    .set(updateData)
    .where(
      and(
        eq(packTemplates.id, templateId),
        eq(packTemplates.userId, auth.userId),
      ),
    );

  const updated = await db.query.packTemplates.findFirst({
    where: and(
      eq(packTemplates.id, templateId),
      eq(packTemplates.userId, auth.userId),
    ),
    with: { items: true },
  });

  if (!updated) return c.json({ error: "Template not found" }, 404);
  return c.json(updated);
});

// Delete a pack template
packTemplateRoutes.delete("/:templateId", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param("templateId");

  await db.delete(packTemplates).where(eq(packTemplates.id, templateId));
  return c.json({ success: true });
});

export { packTemplateRoutes };
