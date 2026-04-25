import { createDb } from '@packrat/api/db';
import { catalogItems, etlJobs, packItems } from '@packrat/api/db/schema';
import { apiKeyAuthPlugin, authPlugin } from '@packrat/api/middleware/auth';
import {
  CatalogItemsQuerySchema,
  CreateCatalogItemRequestSchema,
  UpdateCatalogItemRequestSchema,
  VectorSearchQuerySchema,
} from '@packrat/api/schemas/catalog';
import { CatalogService } from '@packrat/api/services';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import { queueCatalogETL } from '@packrat/api/services/etl/queue';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';
import {
  and,
  cosineDistance,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const catalogETLSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  chunks: z.array(z.string()).min(1, 'At least one object key is required'),
  source: z.string().min(1, 'Source name is required'),
  scraperRevision: z.string().min(1, 'Scraper revision ID is required'),
});

export const catalogRoutes = new Elysia({ prefix: '/catalog' })
  .use(authPlugin)
  .use(apiKeyAuthPlugin)

  // -- List items
  .get(
    '/',
    async ({ query, request }) => {
      const { page, limit, q, category: encodedCategory } = query;
      let category: string | undefined;
      if (typeof encodedCategory === 'string' && encodedCategory.length > 0) {
        try {
          category = decodeURIComponent(encodedCategory);
        } catch {
          category = undefined;
        }
      }

      // Manually parse `sort[field]` / `sort[order]` from raw query.
      // Matches dev's getCatalogItemsRoute behavior; Elysia does not
      // unflatten bracketed query keys.
      const searchParams = new URL(request.url).searchParams;
      const sortField = searchParams.get('sort[field]');
      const sortOrder = searchParams.get('sort[order]');
      const validSortFields = [
        'name',
        'brand',
        'price',
        'ratingValue',
        'createdAt',
        'updatedAt',
        'usage',
      ] as const;
      const validSortOrders = ['asc', 'desc'] as const;
      const sort =
        sortField &&
        sortOrder &&
        validSortFields.includes(sortField as (typeof validSortFields)[number]) &&
        validSortOrders.includes(sortOrder as (typeof validSortOrders)[number])
          ? {
              field: sortField as (typeof validSortFields)[number],
              order: sortOrder as (typeof validSortOrders)[number],
            }
          : undefined;

      const catalogService = new CatalogService();
      const offset = (page - 1) * limit;

      const result = await catalogService.getCatalogItems({
        q,
        limit,
        offset,
        category,
        sort,
      });

      const totalPages = Math.ceil(result.total / limit);

      return {
        items: result.items,
        totalCount: result.total,
        page,
        limit,
        totalPages,
      };
    },
    {
      query: CatalogItemsQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Get catalog items',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Vector search (must come before /:id to avoid shadow)
  .get(
    '/vector-search',
    async ({ query }) => {
      try {
        const { q: searchQuery, limit = 10, offset = 0 } = query;
        const catalogService = new CatalogService();
        return await catalogService.vectorSearch(searchQuery, { limit, offset });
      } catch (error) {
        console.error('Vector search error:', error);
        return status(500, { error: 'Failed to search catalog items' });
      }
    },
    {
      query: VectorSearchQuerySchema,
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Vector search catalog items',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Categories (static path, register before :id)
  .get(
    '/categories',
    async ({ query }) => {
      const categories = await new CatalogService().getCategories(query.limit);
      return categories;
    },
    {
      query: z.object({
        limit: z.coerce.number().int().positive().optional().default(10),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Get catalog categories',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Embeddings stats
  .get(
    '/embeddings-stats',
    async () => {
      const db = createDb();
      const result = await db
        .select({ totalCount: count() })
        .from(catalogItems)
        .where(isNull(catalogItems.embedding));
      const withoutEmbeddings = result[0]?.totalCount ?? 0;
      const totalItemsResult = await db.select({ totalCount: count() }).from(catalogItems);
      const totalItems = totalItemsResult[0]?.totalCount ?? 0;
      return {
        itemsWithoutEmbeddings: Number(withoutEmbeddings),
        totalItems: Number(totalItems),
      };
    },
    {
      isAuthenticated: true,
      detail: { tags: ['Catalog'], summary: 'Get embeddings stats' },
    },
  )

  // -- ETL queue (api-key auth)
  .post(
    '/etl',
    async ({ body }) => {
      const { filename, chunks, source, scraperRevision } = body;
      const db = createDb();
      const env = getEnv();

      if (!env.ETL_QUEUE) {
        return status(400, { message: 'ETL_QUEUE is not configured' });
      }

      const jobId = crypto.randomUUID();

      await db.insert(etlJobs).values({
        id: jobId,
        status: 'running',
        source,
        filename,
        scraperRevision,
        startedAt: new Date(),
      });

      await queueCatalogETL({
        queue: env.ETL_QUEUE,
        objectKeys: chunks,
        jobId,
      });

      return {
        message: 'Catalog ETL job queued successfully',
        jobId,
        queued: true,
      };
    },
    {
      body: catalogETLSchema,
      isValidApiKey: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Queue catalog ETL job from R2 CSV chunk files',
      },
    },
  )

  // -- Backfill embeddings (api-key auth)
  .post(
    '/backfill-embeddings',
    async () => {
      const catalogService = new CatalogService();
      const { count: queuedCount } = await catalogService.queueEmbeddingJobs();
      return { success: true, message: `Queued ${queuedCount} items` };
    },
    {
      isValidApiKey: true,
      detail: { tags: ['Catalog'], summary: 'Backfill embeddings for catalog items' },
    },
  )

  // -- Create
  .post(
    '/',
    async ({ body }) => {
      const db = createDb();
      const data = body;
      const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
        getEnv();

      if (!OPENAI_API_KEY) {
        return status(500, { error: 'OpenAI API key not configured' });
      }

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

      return newItem;
    },
    {
      body: CreateCatalogItemRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Create catalog item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Get by ID
  .get(
    '/:id',
    async ({ params }) => {
      const db = createDb();
      const itemId = Number(params.id);

      const item = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, itemId),
        with: {
          packItems: {
            columns: { id: true },
            where: eq(packItems.deleted, false),
          },
        },
      });

      if (!item) {
        return status(404, { error: 'Catalog item not found' });
      }

      const usageCount = item.packItems?.length || 0;
      const { packItems: _packItems, ...itemData } = item;
      return { ...itemData, usageCount };
    },
    {
      params: z.object({ id: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Get catalog item by ID',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Similar items
  .get(
    '/:id/similar',
    async ({ params, query }) => {
      const db = createDb();
      const itemId = Number(params.id);
      const limit = query.limit ? Number(query.limit) : 5;
      const threshold = query.threshold ? Number(query.threshold) : 0.1;

      const validLimit = Math.min(Math.max(limit, 1), 20);

      const sourceItem = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, itemId),
      });

      if (!sourceItem?.embedding) {
        return status(404, { error: 'Catalog item not found or has no embedding' });
      }

      const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, sourceItem.embedding)})`;
      const { embedding: _embedding, ...columnsToSelect } = getTableColumns(catalogItems);

      const similarItems = await db
        .select({ ...columnsToSelect, similarity })
        .from(catalogItems)
        .where(
          and(
            gt(similarity, threshold),
            ne(catalogItems.id, itemId),
            isNotNull(catalogItems.embedding),
          ),
        )
        .orderBy(desc(similarity))
        .limit(validLimit);

      const { embedding: _sourceEmbedding, ...sourceItemData } = sourceItem;

      return {
        items: similarItems,
        total: similarItems.length,
        sourceItem: sourceItemData,
      };
    },
    {
      params: z.object({ id: z.string() }),
      query: z.object({
        limit: z.string().optional(),
        threshold: z.string().optional(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Get similar catalog items',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Update
  .put(
    '/:id',
    async ({ params, body }) => {
      const db = createDb();
      const itemId = Number(params.id);
      const data = body;
      const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
        getEnv();

      if (!OPENAI_API_KEY) {
        return status(500, { error: 'OpenAI API key not configured' });
      }

      const existingItem = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, itemId),
      });

      if (!existingItem) {
        return status(404, { error: 'Catalog item not found' });
      }

      let embedding: number[] | null = null;
      const newEmbeddingText = getEmbeddingText(data, existingItem);
      const oldEmbeddingText = getEmbeddingText(existingItem);

      if (newEmbeddingText !== oldEmbeddingText) {
        embedding = await generateEmbedding({
          openAiApiKey: OPENAI_API_KEY,
          value: newEmbeddingText,
          provider: AI_PROVIDER,
          cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
          cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
          cloudflareAiBinding: AI,
        });
      }

      const updateData: Partial<typeof catalogItems.$inferInsert> = { ...data };
      if (embedding) updateData.embedding = embedding;
      updateData.updatedAt = new Date();

      const [updatedItem] = await db
        .update(catalogItems)
        .set(updateData)
        .where(eq(catalogItems.id, itemId))
        .returning();

      return updatedItem;
    },
    {
      params: z.object({ id: z.string() }),
      body: UpdateCatalogItemRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Update catalog item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Delete
  .delete(
    '/:id',
    async ({ params }) => {
      const db = createDb();
      const itemId = Number(params.id);

      const existingItem = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, itemId),
      });

      if (!existingItem) {
        return status(404, { error: 'Catalog item not found' });
      }

      await db.delete(catalogItems).where(eq(catalogItems.id, itemId));
      return { success: true };
    },
    {
      params: z.object({ id: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Delete catalog item',
        security: [{ bearerAuth: [] }],
      },
    },
  );
