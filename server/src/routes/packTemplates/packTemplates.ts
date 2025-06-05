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

  await db
    .update(packTemplates)
    .set({
      name: data.name,
      description: data.description,
      category: data.category,
      image: data.image,
      tags: data.tags,
      deleted: data.deleted,
      localUpdatedAt: new Date(data.localUpdatedAt),
      updatedAt: new Date(),
    })
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
