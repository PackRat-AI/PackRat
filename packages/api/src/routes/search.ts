import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  VectorSearchQuerySchema,
  VectorSearchResponseSchema,
} from '@packrat/api/schemas/search';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { createDb } from '../db';
import { catalogItems } from '../db/schema';
import { generateEmbedding } from '../services/embeddingService';

const searchRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

const searchVectorRoute = createRoute({
  method: 'get',
  path: '/vector',
  tags: ['Search'],
  summary: 'Vector similarity search',
  description: 'Search for similar catalog items using AI embeddings and vector similarity',
  security: [{ bearerAuth: [] }],
  request: {
    query: VectorSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'List of similar items with similarity scores',
      content: {
        'application/json': {
          schema: VectorSearchResponseSchema,
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

searchRoutes.openapi(searchVectorRoute, async (c) => {
  const db = createDb(c);
  const { q } = c.req.query();
  const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
    getEnv(c);

  const embedding = await generateEmbedding({
    value: q ?? '',
    openAiApiKey: OPENAI_API_KEY,
    provider: AI_PROVIDER,
    cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
    cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
    cloudflareAiBinding: AI,
  });

  if (!embedding) {
    return c.json({ error: 'Failed to generate embedding', code: 'EMBEDDING_ERROR' }, 500);
  }

  const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, embedding)})`;

  const similarItems = await db
    .select({
      id: catalogItems.id,
      name: catalogItems.name,
      similarity,
    })
    .from(catalogItems)
    .where(gt(similarity, 0.1))
    .orderBy(desc(similarity))
    .limit(10);

  return c.json(similarItems, 200);
});

export { searchRoutes };
