import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packTemplateItems, packTemplates } from '@packrat/api/db/schema';
import {
  CreatePackTemplateItemRequestSchema,
  ErrorResponseSchema,
  PackTemplateItemSchema,
  SuccessResponseSchema,
  UpdatePackTemplateItemRequestSchema,
} from '@packrat/api/schemas/packTemplates';
import type { Variables } from '@packrat/api/types/variables';
import type { Env } from '@packrat/api/types/env';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';

const packTemplateItemsRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Get all items for a template
const getItemsRoute = createRoute({
  method: 'get',
  path: '/{templateId}/items',
  tags: ['Pack Templates'],
  summary: 'Get all items for a template',
  description: 'Retrieve all items for a specific pack template',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      templateId: z.string().openapi({
        example: 'pt_123456',
        description: 'The unique identifier of the pack template',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Template items retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(PackTemplateItemSchema),
        },
      },
    },
    403: {
      description: 'Forbidden - Access denied to this template',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Template not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packTemplateItemsRoutes.openapi(getItemsRoute, async (c) => {
  const auth = c.get('user');

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

  return c.json(items, 200);
});

// Add item to template
const addItemRoute = createRoute({
  method: 'post',
  path: '/{templateId}/items',
  tags: ['Pack Templates'],
  summary: 'Add item to template',
  description: 'Add a new item to a specific pack template',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      templateId: z.string().openapi({
        example: 'pt_123456',
        description: 'The unique identifier of the pack template',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreatePackTemplateItemRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Item added to template successfully',
      content: {
        'application/json': {
          schema: PackTemplateItemSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Access denied to this template',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Template not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packTemplateItemsRoutes.openapi(addItemRoute, async (c) => {
  const auth = c.get('user');

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

  return c.json(newItem, 201);
});

// Update a template item
const updateItemRoute = createRoute({
  method: 'patch',
  path: '/items/{itemId}',
  tags: ['Pack Templates'],
  summary: 'Update a template item',
  description: 'Update a specific item in a pack template',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      itemId: z.string().openapi({
        example: 'pti_123456',
        description: 'The unique identifier of the template item',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePackTemplateItemRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Template item updated successfully',
      content: {
        'application/json': {
          schema: PackTemplateItemSchema,
        },
      },
    },
    400: {
      description: 'Bad request - Invalid input data',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Access denied to this template or item',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Template item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packTemplateItemsRoutes.openapi(updateItemRoute, async (c) => {
  const auth = c.get('user');

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

  return c.json(updatedItem, 200);
});

// Delete a template item
const deleteItemRoute = createRoute({
  method: 'delete',
  path: '/items/{itemId}',
  tags: ['Pack Templates'],
  summary: 'Delete a template item',
  description: 'Delete a specific item from a pack template',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      itemId: z.string().openapi({
        example: 'pti_123456',
        description: 'The unique identifier of the template item',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Template item deleted successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Access denied to this template or item',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Template item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

packTemplateItemsRoutes.openapi(deleteItemRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);
  const itemId = c.req.param('itemId');

  const item = await db.query.packTemplateItems.findFirst({
    where: eq(packTemplateItems.id, itemId),
    with: {
      template: true, // include the template to check permissions
    },
  });

  if (!item) return c.json({ error: 'Item not found' }, 404);
  if (item.template.isAppTemplate && auth.role !== 'ADMIN') {
    return c.json({ error: 'Not allowed' }, 403);
  }

  // Check if user owns the item or is admin for app template
  const canDelete =
    (item.template.isAppTemplate && auth.role === 'ADMIN') || item.userId === auth.userId;

  if (!canDelete) {
    return c.json({ error: 'Not allowed' }, 403);
  }

  await db.delete(packTemplateItems).where(eq(packTemplateItems.id, itemId));

  // Update the parent template's updatedAt timestamp
  await db
    .update(packTemplates)
    .set({ updatedAt: new Date() })
    .where(eq(packTemplates.id, item.packTemplateId));

  return c.json({ success: true }, 200);
});

export { packTemplateItemsRoutes };
