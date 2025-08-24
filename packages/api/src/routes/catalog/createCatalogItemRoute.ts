import { createRoute } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import {
  CatalogItemSchema,
  CreateCatalogItemRequestSchema,
  ErrorResponseSchema,
} from '@packrat/api/schemas/catalog';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/',
  tags: ['Catalog'],
  summary: 'Create catalog item',
  description: 'Create a new catalog item with automatic embedding generation',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: CreateCatalogItemRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Catalog item created successfully',
      content: {
        'application/json': {
          schema: CatalogItemSchema,
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
  const db = createDb(c);
  const data = await c.req.json();
  const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
    getEnv(c);

  if (!OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }

  // Generate embedding
  const embeddingText = getEmbeddingText(data);
  const embedding = await generateEmbedding({
    openAiApiKey: OPENAI_API_KEY,
    value: embeddingText,
    provider: AI_PROVIDER,
    cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
    cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
    cloudflareAiBinding: AI,
  });

  const [newItem] = await db
    .insert(catalogItems)
    .values({
      name: data.name,
      description: data.description,
      weight: data.weight,
      weightUnit: data.weightUnit,
      categories: data.categories,
      images: data.images,
      brand: data.brand,
      model: data.model,

      // New fields
      ratingValue: data.ratingValue,
      productUrl: data.productUrl,
      color: data.color,
      size: data.size,
      sku: data.sku,
      price: data.price,
      availability: data.availability,
      seller: data.seller,
      productSku: data.productSku,
      material: data.material,
      currency: data.currency,
      condition: data.condition,
      techs: data.techs,
      links: data.links,
      reviews: data.reviews,
      embedding,
    })
    .returning();

  return c.json(newItem, 200);
};
