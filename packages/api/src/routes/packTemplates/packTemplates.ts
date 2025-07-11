import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { type PackTemplate, packTemplates } from '@packrat/api/db/schema';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { and, eq, or } from 'drizzle-orm';

const packTemplateRoutes = new OpenAPIHono();

// Get all templates
const getTemplatesRoute = createRoute({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'Get all pack templates' } },
});

packTemplateRoutes.openapi(getTemplatesRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templates = await db.query.packTemplates.findMany({
    where: or(
      eq(packTemplates.userId, auth.userId), // user can access their own templates
      eq(packTemplates.isAppTemplate, true), // or app templates
    ),
    with: { items: true },
  });

  return c.json(templates);
});

// Create a new template
const createTemplateRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: { 201: { description: 'Create a new pack template' } },
});

packTemplateRoutes.openapi(createTemplateRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const data = await c.req.json();

  const isAppTemplate = auth.role === 'ADMIN' ? data.isAppTemplate : false;

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
      isAppTemplate,
      localCreatedAt: new Date(data.localCreatedAt),
      localUpdatedAt: new Date(data.localUpdatedAt),
    })
    .returning();

  return c.json(newTemplate);
});

// Get a specific pack template
const getTemplateRoute = createRoute({
  method: 'get',
  path: '/{templateId}',
  request: {
    params: z.object({ templateId: z.string() }),
  },
  responses: { 200: { description: 'Get a specific pack template' } },
});

packTemplateRoutes.openapi(getTemplateRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param('templateId');

  const template = await db.query.packTemplates.findFirst({
    where: and(
      eq(packTemplates.id, templateId),
      or(
        eq(packTemplates.userId, auth.userId), // user can access their own templates
        eq(packTemplates.isAppTemplate, true), // or featured templates
      ),
      eq(packTemplates.deleted, false),
    ),
    with: { items: true },
  });

  if (!template) return c.json({ error: 'Template not found' }, 404);
  return c.json(template);
});

// Update a pack template
const updateTemplateRoute = createRoute({
  method: 'put',
  path: '/{templateId}',
  request: {
    params: z.object({ templateId: z.string() }),
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: { 200: { description: 'Update a pack template' } },
});

packTemplateRoutes.openapi(updateTemplateRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param('templateId');
  const data = await c.req.json();

  const updateData: Partial<PackTemplate> = {};
  if ('name' in data) updateData.name = data.name;
  if ('description' in data) updateData.description = data.description;
  if ('category' in data) updateData.category = data.category;
  if ('image' in data) updateData.image = data.image;
  if ('tags' in data) updateData.tags = data.tags;
  if ('isAppTemplate' in data && auth.role === 'ADMIN')
    updateData.isAppTemplate = data.isAppTemplate;
  if ('deleted' in data) updateData.deleted = data.deleted;
  if ('localUpdatedAt' in data) updateData.localUpdatedAt = new Date(data.localUpdatedAt);

  await db
    .update(packTemplates)
    .set(updateData)
    .where(
      data.isAppTemplate && auth.role === 'ADMIN'
        ? eq(packTemplates.id, templateId) // any admin can change an app template
        : // regular users can only update their own templates
          and(eq(packTemplates.id, templateId), eq(packTemplates.userId, auth.userId)),
    );

  const updated = await db.query.packTemplates.findFirst({
    where:
      data.isAppTemplate && auth.role === 'ADMIN'
        ? eq(packTemplates.id, templateId)
        : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, auth.userId)),
    with: { items: true },
  });

  if (!updated) return c.json({ error: 'Template not found' }, 404);
  return c.json(updated);
});

// Delete a pack template
const deleteTemplateRoute = createRoute({
  method: 'delete',
  path: '/{templateId}',
  request: {
    params: z.object({ templateId: z.string() }),
  },
  responses: { 200: { description: 'Delete a pack template' } },
});

packTemplateRoutes.openapi(deleteTemplateRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param('templateId');

  const packTemplate = await db.query.packTemplates.findFirst({
    where: eq(packTemplates.id, templateId),
  });

  if (!packTemplate) return c.json({ error: 'Template not found' }, 404);
  if (packTemplate.isAppTemplate && auth.role !== 'ADMIN') {
    return c.json({ error: 'Not allowed' }, 403);
  }

  await db.delete(packTemplates).where(
    packTemplate.isAppTemplate && auth.role === 'ADMIN'
      ? eq(packTemplates.id, templateId) // any admin can delete an app template
      : // regular users can only delete their own templates
        and(eq(packTemplates.id, templateId), eq(packTemplates.userId, auth.userId)),
  );

  return c.json({ success: true });
});

export { packTemplateRoutes };
