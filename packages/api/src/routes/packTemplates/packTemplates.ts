import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { type PackTemplate, packTemplates } from '@packrat/api/db/schema';
import {
  CreatePackTemplateRequestSchema,
  ErrorResponseSchema,
  PackTemplateWithItemsSchema,
  SuccessResponseSchema,
  UpdatePackTemplateRequestSchema,
} from '@packrat/api/schemas/packTemplates';
import type { Variables } from '@packrat/api/types/variables';
import type { Env } from '@packrat/api/utils/env-validation';
import { and, eq, or } from 'drizzle-orm';

const packTemplateRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Get all templates
const getTemplatesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Pack Templates'],
  summary: 'Get all pack templates',
  description:
    'Retrieve all pack templates accessible to the authenticated user (own templates and app templates)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Pack templates retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(PackTemplateWithItemsSchema),
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

packTemplateRoutes.openapi(getTemplatesRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);
  const templates = await db.query.packTemplates.findMany({
    where: or(
      eq(packTemplates.userId, auth.userId), // user can access their own templates
      eq(packTemplates.isAppTemplate, true), // or app templates
    ),
    with: { items: true },
  });

  return c.json(templates, 200);
});

// Create a new template
const createTemplateRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Pack Templates'],
  summary: 'Create a new pack template',
  description: 'Create a new pack template for the authenticated user',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePackTemplateRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Pack template created successfully',
      content: {
        'application/json': {
          schema: PackTemplateWithItemsSchema,
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

packTemplateRoutes.openapi(createTemplateRoute, async (c) => {
  const auth = c.get('user');

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

  return c.json(newTemplate, 201);
});

// Get a specific pack template
const getTemplateRoute = createRoute({
  method: 'get',
  path: '/{templateId}',
  tags: ['Pack Templates'],
  summary: 'Get a specific pack template',
  description: 'Retrieve a specific pack template by ID with all its items',
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
      description: 'Pack template retrieved successfully',
      content: {
        'application/json': {
          schema: PackTemplateWithItemsSchema,
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

packTemplateRoutes.openapi(getTemplateRoute, async (c) => {
  const auth = c.get('user');

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
  return c.json(template, 200);
});

// Update a pack template
const updateTemplateRoute = createRoute({
  method: 'put',
  path: '/{templateId}',
  tags: ['Pack Templates'],
  summary: 'Update a pack template',
  description: 'Update a specific pack template by ID',
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
          schema: UpdatePackTemplateRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Pack template updated successfully',
      content: {
        'application/json': {
          schema: PackTemplateWithItemsSchema,
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

packTemplateRoutes.openapi(updateTemplateRoute, async (c) => {
  const auth = c.get('user');
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
  return c.json(updated, 200);
});

// Delete a pack template
const deleteTemplateRoute = createRoute({
  method: 'delete',
  path: '/{templateId}',
  tags: ['Pack Templates'],
  summary: 'Delete a pack template',
  description: 'Delete a specific pack template by ID',
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
      description: 'Pack template deleted successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
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

packTemplateRoutes.openapi(deleteTemplateRoute, async (c) => {
  const auth = c.get('user');

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

  return c.json({ success: true }, 200);
});

export { packTemplateRoutes };
