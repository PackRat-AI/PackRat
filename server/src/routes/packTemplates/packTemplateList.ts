import { createDb } from "@/db";
import { packTemplates } from "@/db/schema";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

const packTemplateListRoutes = new Hono();

// Get all templates
packTemplateListRoutes.get("/", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templates = await db.query.packTemplates.findMany({
    where: eq(packTemplates.userId, auth.userId),
    with: { items: true },
  });

  return c.json(templates);
});

// Create a new template
packTemplateListRoutes.post("/", async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const data = await c.req.json();

  const [newTemplate] = await db
    .insert(packTemplates)
    .values({
      id: data.id,
      userId: auth.userId,
      name: data.name,
      description: data.description,
      category: data.category,
      image: data.image,
      tags: data.tags,
      localCreatedAt: new Date(data.localCreatedAt),
      localUpdatedAt: new Date(data.localUpdatedAt),
    })
    .returning();

  return c.json(newTemplate);
});

export { packTemplateListRoutes };
