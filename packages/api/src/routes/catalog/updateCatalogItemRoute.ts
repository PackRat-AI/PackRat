import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import {
  CatalogItemSchema,
  ErrorResponseSchema,
  UpdateCatalogItemRequestSchema,
} from '@packrat/api/schemas/catalog';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';
import { eq } from 'drizzle-orm';

export const routeDefinition = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Catalog'],
  summary: 'Update catalog item',
  description: 'Update an existing catalog item with automatic embedding regeneration if needed',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        example: '123',
        description: 'Catalog item ID',
      }),
    }),
    body: {
      content: {
        'application/json': { schema: UpdateCatalogItemRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Catalog item updated successfully',
      content: {
        'application/json': {
          schema: CatalogItemSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Catalog item not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // TODO: Only admins should be able to update catalog items
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const itemId = Number(c.req.param('id'));
  const data = await c.req.json();
  const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID_ORG, CLOUDFLARE_AI_GATEWAY_ID_ORG } =
    getEnv(c);

  if (!OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }

  const existingItem = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, itemId),
  });

  if (!existingItem) {
    return c.json({ error: 'Catalog item not found' }, 404);
  }

  // Only generate a new embedding if the text has changed
  let embedding: number[] | undefined;
  const newEmbeddingText = getEmbeddingText(data, existingItem);
  const oldEmbeddingText = getEmbeddingText(existingItem);

  if (newEmbeddingText !== oldEmbeddingText) {
    embedding = await generateEmbedding({
      openAiApiKey: OPENAI_API_KEY,
      value: newEmbeddingText,
      provider: AI_PROVIDER,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID_ORG,
      cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID_ORG,
    });
  }

  const updateData: Partial<typeof catalogItems.$inferInsert> = { ...data };
  if (embedding) {
    updateData.embedding = embedding;
  }
  updateData.updatedAt = new Date();

  // Update the catalog item
  const [updatedItem] = await db
    .update(catalogItems)
    .set(updateData)
    .where(eq(catalogItems.id, itemId))
    .returning();

  return c.json(updatedItem, 200);
};
