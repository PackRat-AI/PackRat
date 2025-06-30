import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { catalogItems } from '@packrat/api/db/schema';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import type { Env } from '@packrat/api/types/env';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { env } from 'hono/adapter';

const catalogListRoutes = new OpenAPIHono();

const listGetRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      id: z.string().optional(),
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().nonnegative().optional().default(20),
      q: z.string().optional(),
      category: z.string().optional(),
    }),
  },
  responses: { 200: { description: 'Get catalog items' } },
});

catalogListRoutes.openapi(listGetRoute, async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const { id, page, limit, q, category } = c.req.valid('query');

  if (id) {
    // Get a specific catalog item
    const item = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, Number.parseInt(id, 10)),
    });

    if (!item) {
      return c.json({ error: 'Catalog item not found' }, { status: 404 });
    }

    return c.json(item);
  }

  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(catalogItems.name, `%${q}%`),
        ilike(catalogItems.description, `%${q}%`),
        ilike(catalogItems.brand, `%${q}%`),
        ilike(catalogItems.model, `%${q}%`),
        ilike(catalogItems.category, `%${q}%`)
      )
    );
  }
  if (category) {
    conditions.push(eq(catalogItems.category, category));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (limit === 0) {
    const items = await db.query.catalogItems.findMany({
      where,
      orderBy: [desc(catalogItems.id)],
    });
    return c.json({
      items,
      totalCount: items.length,
      page: 1,
      limit: items.length > 0 ? items.length : 1,
      totalPages: 1,
    });
  }

  // Get paginated catalog items
  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    db.query.catalogItems.findMany({
      where,
      limit: limit,
      offset,
      orderBy: [desc(catalogItems.id)],
    }),
    db.select({ count: count() }).from(catalogItems).where(where),
  ]);

  const totalCount = total[0].count;
  const totalPages = Math.ceil(totalCount / limit);

  return c.json({
    items,
    totalCount,
    page,
    limit,
    totalPages,
  });
});

const listPostRoute = createRoute({
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

catalogListRoutes.openapi(listPostRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const data = await c.req.json();
  const { OPENAI_API_KEY } = env<Env>(c);

  if (!OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API key not configured' }, 500);
  }

  // Generate embedding
  const embeddingText = getEmbeddingText(data);
  const embedding = await generateEmbedding({
    openAiApiKey: OPENAI_API_KEY,
    value: embeddingText,
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
});

export { catalogListRoutes };
