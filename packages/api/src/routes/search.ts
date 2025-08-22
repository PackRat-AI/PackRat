import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  ErrorResponseSchema,
  VectorSearchQuerySchema,
  VectorSearchResponseSchema,
} from '@packrat/api/schemas/search';
import type { Variables } from '@packrat/api/types/variables';
import type { Env } from '@packrat/api/types/env';
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
  try {
    const auth = c.get('user');
    if (!auth) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const db = createDb(c);
    const { q } = c.req.valid('query');
    const {
      OPENAI_API_KEY,
      AI_PROVIDER,
      CLOUDFLARE_ACCOUNT_ID_ORG,
      CLOUDFLARE_AI_GATEWAY_ID_ORG,
      AI,
    } = getEnv(c);

    const embedding = await generateEmbedding({
      value: q,
      openAiApiKey: OPENAI_API_KEY,
      provider: AI_PROVIDER,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID_ORG,
      cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID_ORG,
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
  } catch (error) {
    console.error('Error performing vector search:', error);
    return c.json({ error: 'Internal server error', code: 'SEARCH_ERROR' }, 500);
  }
});

export { searchRoutes };
