import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';

export const routeDefinition = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': { schema: z.any() },
      },
    },
  },
  responses: { 200: { description: 'Create catalog item' } },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const data = await c.req.json();
  const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID_ORG, CLOUDFLARE_AI_GATEWAY_ID_ORG } =
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
    cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID_ORG,
    cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID_ORG,
  });

  const [newItem] = await db
    .insert(catalogItems)
    .values({
      name: data.name,
      description: data.description,
      defaultWeight: data.defaultWeight,
      defaultWeightUnit: data.defaultWeightUnit,
      category: data.category,
      image: data.image,
      brand: data.brand,
      model: data.model,
      url: data.url,

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

  return c.json(newItem);
};
