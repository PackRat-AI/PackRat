import { createDb } from '@packrat/api/db';
import { packTemplateItems, packTemplates } from '@packrat/api/db/schema';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';

import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';

const packTemplateItemsRoutes = new OpenAPIHono();

// Get all items for a template
const getItemsRoute = createRoute({
  method: 'get',
  path: '/{templateId}/items',
  request: { params: z.object({ templateId: z.string() }) },
  responses: { 200: { description: 'Get all items for a template' } },
});

packTemplateItemsRoutes.openapi(getItemsRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param('templateId');

  const items = await db
    .select()
    .from(packTemplateItems)
    .leftJoin(packTemplates, eq(packTemplates.id, packTemplateItems.packTemplateId))
    .where(
      and(
        eq(packTemplateItems.packTemplateId, templateId),
        or(
          eq(packTemplateItems.userId, auth.userId), // user can access items of their own templates
          eq(packTemplates.isAppTemplate, true), // or items of app templates
        ),
      ),
    );

  return c.json(items);
});

// Add item to template
const addItemRoute = createRoute({
  method: 'post',
  path: '/{templateId}/items',
  request: {
    params: z.object({ templateId: z.string() }),
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: { 201: { description: 'Add item to template' } },
});

packTemplateItemsRoutes.openapi(addItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const templateId = c.req.param('templateId');
  const data = await c.req.json();

  const packTemplate = await db.query.packTemplates.findFirst({
    where: eq(packTemplates.id, templateId),
  });

  if (!packTemplate) return c.json({ error: 'Template not found' }, 404);
  if (packTemplate.isAppTemplate && auth.role !== 'ADMIN') {
    return c.json({ error: 'Not allowed' }, 403);
  }

  const [newItem] = await db
    .insert(packTemplateItems)
    .values({
      id: data.id,
      packTemplateId: templateId,
      name: data.name,
      description: data.description,
      weight: data.weight,
      weightUnit: data.weightUnit,
      quantity: data.quantity || 1,
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
const updateItemRoute = createRoute({
  method: 'patch',
  path: '/items/{itemId}',
  request: {
    params: z.object({ itemId: z.string() }),
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: { 200: { description: 'Update a template item' } },
});

packTemplateItemsRoutes.openapi(updateItemRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) return unauthorizedResponse();

  const db = createDb(c);
  const itemId = c.req.param('itemId');
  const data = await c.req.json();

  const item = await db.query.packTemplateItems.findFirst({
    where: and(eq(packTemplateItems.id, itemId)),
    with: {
      template: true, // include the template to check permissions
    },
  });

  if (!item) return c.json({ error: 'Item not found' }, 404);
  if (item.template.isAppTemplate && auth.role !== 'ADMIN') {
    return c.json({ error: 'Not allowed' }, 403);
  }

  const updateData: Partial<typeof packTemplateItems.$inferInsert> = {};
  if ('name' in data) updateData.name = data.name;
  if ('description' in data) updateData.description = data.description;
  if ('weight' in data) updateData.weight = data.weight;
  if ('weightUnit' in data) updateData.weightUnit = data.weightUnit;
  if ('quantity' in data) updateData.quantity = data.quantity;
  if ('category' in data) updateData.category = data.category;
  if ('consumable' in data) updateData.consumable = data.consumable;
  if ('worn' in data) updateData.worn = data.worn;
  if ('image' in data) updateData.image = data.image;
  if ('notes' in data) updateData.notes = data.notes;
  if ('deleted' in data) updateData.deleted = data.deleted;

  // TODO add old image deletion logic

  const [updatedItem] = await db
    .update(packTemplateItems)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(
      item.template.isAppTemplate && auth.role === 'ADMIN'
        ? eq(packTemplateItems.id, itemId) // any admin can update app template item
        : and(eq(packTemplateItems.id, itemId), eq(packTemplateItems.userId, auth.userId)),
    )
    .returning();

  return c.json(updatedItem);
});

export { packTemplateItemsRoutes };
