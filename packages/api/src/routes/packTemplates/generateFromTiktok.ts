import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packTemplateItems, packTemplates } from '@packrat/api/db/schema';
import { adminMiddleware } from '@packrat/api/middleware/adminMiddleware';
import { ErrorResponseSchema, PackTemplateWithItemsSchema } from '@packrat/api/schemas/packTemplates';
import { CatalogService } from '@packrat/api/services/catalogService';
import { TiktokService } from '@packrat/api/services/tiktokService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { eq } from 'drizzle-orm';

const generateFromTiktokRoute = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

generateFromTiktokRoute.use('*', adminMiddleware);

const route = createRoute({
  method: 'post',
  path: '/generate-from-tiktok',
  tags: ['Pack Templates'],
  summary: 'Generate a pack template from a TikTok URL (Admin only)',
  description:
    'Analyzes a TikTok video URL using AI to extract gear/pack information and creates a new app template with matching catalog items. Requires admin privileges.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            url: z.string().url().openapi({
              example: 'https://www.tiktok.com/@user/video/1234567890',
              description: 'TikTok video URL to extract pack information from',
            }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Pack template created successfully from TikTok content',
      content: {
        'application/json': {
          schema: PackTemplateWithItemsSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict - a template from this URL already exists',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    422: {
      description: 'Unprocessable - TikTok content extraction failed',
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

generateFromTiktokRoute.openapi(route, async (c) => {
  const auth = c.get('user');
  const db = createDb(c);
  const { url } = c.req.valid('json');

  // Check for duplicate — reject if a template with this source URL already exists
  const existing = await db.query.packTemplates.findFirst({
    where: eq(packTemplates.sourceUrl, url),
  });
  if (existing) {
    return c.json({ error: 'A template from this TikTok URL already exists' }, 409);
  }

  // Extract pack concept from TikTok using AI
  let concept;
  try {
    const tiktokService = new TiktokService(c);
    concept = await tiktokService.extractPackConcept(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract content from TikTok';
    return c.json({ error: message }, 422);
  }

  // Search catalog for matching items
  const catalogService = new CatalogService(c);
  const itemNames = concept.items.map((item) => item.name);
  const searchResults =
    itemNames.length > 0 ? await catalogService.batchVectorSearch(itemNames, 1) : { items: [] };

  // Create template + items in a transaction
  const templateId = crypto.randomUUID();
  const now = new Date();

  await db
    .insert(packTemplates)
    .values({
      id: templateId,
      userId: auth.userId,
      name: concept.name,
      description: concept.description ?? null,
      category: concept.category,
      tags: concept.tags ?? [],
      isAppTemplate: true,
      sourceUrl: url,
      localCreatedAt: now,
      localUpdatedAt: now,
    })
    .returning();

  const itemsToInsert = concept.items.map((item, idx) => {
    const catalogItem = searchResults.items[idx]?.[0];
    return {
      id: crypto.randomUUID(),
      packTemplateId: templateId,
      userId: auth.userId,
      name: item.name,
      description: item.description ?? null,
      weight: item.weight,
      weightUnit: item.weightUnit,
      quantity: item.quantity,
      category: item.category ?? null,
      consumable: item.consumable,
      worn: item.worn,
      notes: item.notes ?? null,
      catalogItemId: catalogItem?.id ?? null,
    };
  });

  if (itemsToInsert.length > 0) {
    await db.insert(packTemplateItems).values(itemsToInsert);
  }

  const templateWithItems = await db.query.packTemplates.findFirst({
    where: eq(packTemplates.id, templateId),
    with: { items: true },
  });

  if (!templateWithItems) {
    return c.json({ error: 'Failed to create template' }, 500);
  }

  return c.json(templateWithItems, 201);
});

export { generateFromTiktokRoute };
