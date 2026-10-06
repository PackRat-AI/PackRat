import { createDb } from '@packrat/api/db';
import { adminAuthPlugin, authPlugin } from '@packrat/api/middleware/auth';
import {
  classifyImportError,
  importPackTemplateFromOnlineContent,
} from '@packrat/api/services/packTemplateImportService';
import { type PackTemplate, packTemplateItems, packTemplates } from '@packrat/db/schema';
import { assertDefined } from '@packrat/guards';
import {
  AIPackAnalysisSchema,
  CreatePackTemplateItemRequestSchema,
  CreatePackTemplateRequestSchema,
  GenerateFromOnlineContentRequestSchema,
  UpdatePackTemplateItemRequestSchema,
  UpdatePackTemplateRequestSchema,
} from '@packrat/schemas/packTemplates';
import { and, eq, or } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const packTemplatesRoutes = new Elysia({ prefix: '/pack-templates' })
  .model({
    'packTemplates.AIPackAnalysis': AIPackAnalysisSchema,
    'packTemplates.CreatePackTemplateItemRequest': CreatePackTemplateItemRequestSchema,
    'packTemplates.CreatePackTemplateRequest': CreatePackTemplateRequestSchema,
    'packTemplates.GenerateFromOnlineContentRequest': GenerateFromOnlineContentRequestSchema,
    'packTemplates.UpdatePackTemplateItemRequest': UpdatePackTemplateItemRequestSchema,
    'packTemplates.UpdatePackTemplateRequest': UpdatePackTemplateRequestSchema,
  })
  .use(authPlugin)
  .use(adminAuthPlugin)

  // List all templates
  .get(
    '/',
    async ({ user }) => {
      const db = createDb();
      const templates = await db.tag('packTemplates.list').query.packTemplates.findMany({
        where: and(
          or(eq(packTemplates.userId, user.userId), eq(packTemplates.isAppTemplate, true)),
          eq(packTemplates.deleted, false),
        ),
        with: { items: { where: eq(packTemplateItems.deleted, false) } },
      });
      return templates;
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Get all pack templates',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Create template
  .post(
    '/',
    async ({ body, user }) => {
      const db = createDb();
      const data = body;

      const isAppTemplate = user.role === 'ADMIN' ? data.isAppTemplate : false;

      const [newTemplate] = await db
        .tag('packTemplates.create')
        .insert(packTemplates)
        .values({
          id: data.id,
          userId: user.userId,
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

      assertDefined(newTemplate, 'Failed to create pack template');

      const templateWithItems = await db
        .tag('packTemplates.getById')
        .query.packTemplates.findFirst({
          where: eq(packTemplates.id, newTemplate.id),
          with: { items: true },
        });

      return status(201, templateWithItems);
    },
    {
      body: 'packTemplates.CreatePackTemplateRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Create a new pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Generate from online content
  .post(
    '/generate-from-online-content',
    async ({ body, user }) => {
      try {
        const result = await importPackTemplateFromOnlineContent({
          contentUrl: body.contentUrl,
          ownerUserId: user.userId,
          isAppTemplate: body.isAppTemplate ?? true,
        });
        if (result.ok) return status(201, result.template);
        switch (result.reason) {
          case 'invalid_url':
            return status(400, { error: 'contentUrl must be a valid URL' });
          case 'fetch_failed':
            return status(500, {
              error: `Failed to fetch data from URL: ${result.message}`,
              code: 'TIKTOK_SERVICE_ERROR',
            });
          case 'duplicate':
            return status(409, {
              error: 'Template already exists for this content.',
              code: 'DUPLICATE_TEMPLATE',
              existingTemplateId: result.existingTemplateId,
            });
        }
      } catch (error) {
        console.error('Error generating pack template:', error);
        return status(500, {
          error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: classifyImportError(error),
        });
      }
    },
    {
      body: 'packTemplates.GenerateFromOnlineContentRequest',
      isAdmin: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Generate a pack template from an online content URL (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update template item
  .patch(
    '/items/:itemId',
    async ({ params, body, user }) => {
      const db = createDb();
      const itemId = params.itemId;
      const data = body;

      const item = await db.tag('packTemplates.getItem').query.packTemplateItems.findFirst({
        where: eq(packTemplateItems.id, itemId),
        with: { template: true },
      });

      if (!item) return status(404, { error: 'Item not found' });
      if (item.template.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
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

      const [updatedItem] = await db
        .tag('packTemplates.updateItem')
        .update(packTemplateItems)
        .set({ ...updateData, updatedAt: new Date() })
        .where(
          item.template.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplateItems.id, itemId)
            : and(eq(packTemplateItems.id, itemId), eq(packTemplateItems.userId, user.userId)),
        )
        .returning();

      return updatedItem;
    },
    {
      params: z.object({ itemId: z.string() }),
      body: 'packTemplates.UpdatePackTemplateItemRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Update a template item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete template item
  .delete(
    '/items/:itemId',
    async ({ params, user }) => {
      const db = createDb();
      const itemId = params.itemId;

      const item = await db.tag('packTemplates.getItem').query.packTemplateItems.findFirst({
        where: eq(packTemplateItems.id, itemId),
        with: { template: true },
      });

      if (!item) return status(404, { error: 'Item not found' });
      if (item.template.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      const canDelete =
        (item.template.isAppTemplate && user.role === 'ADMIN') || item.userId === user.userId;
      if (!canDelete) return status(403, { error: 'Not allowed' });

      await db
        .tag('packTemplates.deleteItem')
        .delete(packTemplateItems)
        .where(eq(packTemplateItems.id, itemId));
      await db
        .tag('packTemplates.update')
        .update(packTemplates)
        .set({ updatedAt: new Date() })
        .where(eq(packTemplates.id, item.packTemplateId));

      return { success: true };
    },
    {
      params: z.object({ itemId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Delete a template item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Get template
  .get(
    '/:templateId',
    async ({ params, user }) => {
      const db = createDb();
      const templateId = params.templateId;

      const template = await db.tag('packTemplates.getById').query.packTemplates.findFirst({
        where: and(
          eq(packTemplates.id, templateId),
          or(eq(packTemplates.userId, user.userId), eq(packTemplates.isAppTemplate, true)),
          eq(packTemplates.deleted, false),
        ),
        with: { items: { where: eq(packTemplateItems.deleted, false) } },
      });

      if (!template) return status(404, { error: 'Template not found' });
      return template;
    },
    {
      params: z.object({ templateId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Get a specific pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update template
  .put(
    '/:templateId',
    async ({ params, body, user }) => {
      const db = createDb();
      const templateId = params.templateId;
      const data = body;

      const updateData: Partial<PackTemplate> = {};
      if ('name' in data) updateData.name = data.name;
      if ('description' in data) updateData.description = data.description;
      if ('category' in data) updateData.category = data.category;
      if ('image' in data) updateData.image = data.image;
      if ('tags' in data) updateData.tags = data.tags;
      if ('isAppTemplate' in data && user.role === 'ADMIN')
        updateData.isAppTemplate = data.isAppTemplate;
      if ('deleted' in data) updateData.deleted = data.deleted;
      if ('localUpdatedAt' in data && data.localUpdatedAt)
        updateData.localUpdatedAt = new Date(data.localUpdatedAt);

      await db
        .tag('packTemplates.update')
        .update(packTemplates)
        .set(updateData)
        .where(
          data.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplates.id, templateId)
            : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, user.userId)),
        );

      const updated = await db.tag('packTemplates.getById').query.packTemplates.findFirst({
        where:
          data.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplates.id, templateId)
            : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, user.userId)),
        with: { items: true },
      });

      if (!updated) return status(404, { error: 'Template not found' });
      return updated;
    },
    {
      params: z.object({ templateId: z.string() }),
      body: 'packTemplates.UpdatePackTemplateRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Update a pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete template
  .delete(
    '/:templateId',
    async ({ params, user }) => {
      const db = createDb();
      const templateId = params.templateId;

      const packTemplate = await db.tag('packTemplates.getById').query.packTemplates.findFirst({
        where: eq(packTemplates.id, templateId),
      });

      if (!packTemplate) return status(404, { error: 'Template not found' });
      if (packTemplate.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      await db
        .tag('packTemplates.delete')
        .delete(packTemplates)
        .where(
          packTemplate.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplates.id, templateId)
            : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, user.userId)),
        );

      return { success: true };
    },
    {
      params: z.object({ templateId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Delete a pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // List template items
  .get(
    '/:templateId/items',
    async ({ params, user }) => {
      const db = createDb();
      const templateId = params.templateId;

      const template = await db.tag('packTemplates.getById').query.packTemplates.findFirst({
        where: eq(packTemplates.id, templateId),
      });

      if (!template) return status(404, { error: 'Template not found' });

      const hasAccess = template.isAppTemplate || template.userId === user.userId;
      if (!hasAccess) return status(403, { error: 'Access denied to this template' });

      const items = await db
        .tag('packTemplates.listItems')
        .select()
        .from(packTemplateItems)
        .where(
          and(
            eq(packTemplateItems.packTemplateId, templateId),
            eq(packTemplateItems.deleted, false),
          ),
        );

      return items;
    },
    {
      params: z.object({ templateId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Get all items for a template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Add template item
  .post(
    '/:templateId/items',
    async ({ params, body, user }) => {
      const db = createDb();
      const templateId = params.templateId;
      const data = body;

      const packTemplate = await db.tag('packTemplates.getById').query.packTemplates.findFirst({
        where: eq(packTemplates.id, templateId),
      });

      if (!packTemplate) return status(404, { error: 'Template not found' });
      if (packTemplate.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      const [newItem] = await db
        .tag('packTemplates.createItem')
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
          consumable: data.consumable ?? false,
          worn: data.worn ?? false,
          image: data.image,
          notes: data.notes,
          userId: user.userId,
        })
        .returning();

      await db
        .tag('packTemplates.update')
        .update(packTemplates)
        .set({ updatedAt: new Date() })
        .where(eq(packTemplates.id, templateId));

      return status(201, newItem);
    },
    {
      params: z.object({ templateId: z.string() }),
      body: 'packTemplates.CreatePackTemplateItemRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Add item to template',
        security: [{ bearerAuth: [] }],
      },
    },
  );
