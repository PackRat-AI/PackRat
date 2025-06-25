import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { env } from 'hono/adapter';
import type { Env } from '../types/env';
import { createDb } from '../db';
import { catalogItems } from '../db/schema';
import { authenticateRequest, unauthorizedResponse } from '../utils/api-middleware';
import { generateEmbedding } from '../services/embeddingService';

const searchRoutes = new OpenAPIHono<{ Bindings: Env }>();

const searchVectorRoute = createRoute({
  method: 'get',
  path: '/vector',
  request: {
    query: z.object({
      q: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'Search similar catalog items',
    },
    401: {
      description: 'Unauthorized',
    },
    500: {
      description: 'Internal Server Error',
    },
  },
});

searchRoutes.openapi(searchVectorRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const { q } = c.req.query();
  const { OPENAI_API_KEY } = env<Env>(c);

  const embedding = await generateEmbedding({
    value: q,
    openAiApiKey: OPENAI_API_KEY,
  });

  if (!embedding) {
    return c.json({ error: 'Failed to generate embedding' }, 500);
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

  return c.json(similarItems);
});

export { searchRoutes };
