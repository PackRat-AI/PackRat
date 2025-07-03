import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import { Env } from '@packrat/api/types/env';
import { RouteHandler } from '@packrat/api/types/routeHandler';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { eq } from 'drizzle-orm';
import { env } from 'hono/adapter';

export const routeDefinition = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: { 200: { description: 'Update catalog item' } },
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
  const { OPENAI_API_KEY } = env<Env>(c);

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

  return c.json(updatedItem);
};
