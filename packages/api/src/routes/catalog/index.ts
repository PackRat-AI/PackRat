import { createDb } from '@packrat/api/db';
import { apiKeyAuthPlugin, authPlugin } from '@packrat/api/middleware/auth';
import { CatalogService } from '@packrat/api/services';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import { queueCatalogETL } from '@packrat/api/services/etl/queue';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv } from '@packrat/api/utils/env-validation';
import { catalogItems, etlJobs, packItems } from '@packrat/db';
import { isString } from '@packrat/guards';
import {
  CatalogCategoriesResponseSchema,
  CatalogCompareRequestSchema,
  CatalogETLSchema,
  CatalogItemSchema,
  CatalogItemsQuerySchema,
  CatalogItemsResponseSchema,
  CreateCatalogItemRequestSchema,
  UpdateCatalogItemRequestSchema,
  VectorSearchQuerySchema,
} from '@packrat/schemas/catalog';
import { ErrorResponseSchema } from '@packrat/schemas/shared';
import {
  and,
  cosineDistance,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
import { Elysia, NotFoundError, status } from 'elysia';
import { z } from 'zod';

export const catalogRoutes = new Elysia({ prefix: '/catalog' })
  .use(authPlugin)
  .use(apiKeyAuthPlugin)

  // -- List items
  .get(
    '/',
    async ({ query }) => {
      const { page = 1, limit = 20, q, category: encodedCategory, sort } = query;
      let category: string | undefined;
      if (isString(encodedCategory) && encodedCategory.length > 0) {
        try {
          category = decodeURIComponent(encodedCategory);
        } catch {
          category = undefined;
        }
      }

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

      return CatalogItemsResponseSchema.parse({
        items: result.items,
        totalCount: result.total,
        page,
        limit,
        totalPages,
      });
    },
    {
      query: CatalogItemsQuerySchema,
      response: { 200: CatalogItemsResponseSchema },
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
      return CatalogCategoriesResponseSchema.parse(categories);
    },
    {
      // Service applies its own default (10); keep schema truly optional.
      query: z.object({
        limit: z.coerce.number().int().positive().optional(),
      }),
      response: { 200: CatalogCategoriesResponseSchema },
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Get catalog categories',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Compare items side-by-side (static path, register before /:id)
  .post(
    '/compare',
    async ({ body }) => {
      const db = createDb();
      const { ids } = body;
      const uniqueIds = Array.from(new Set(ids));
      // `ids.min(2)` accepts [1, 1] which collapses to 1 unique ID after
      // dedupe; enforce the 2+ floor on the deduped set so the response
      // actually contains a comparison.
      if (uniqueIds.length < 2) {
        return status(400, { error: 'Compare requires at least 2 distinct catalog IDs' });
      }
      const items = await db
        .select({
          id: catalogItems.id,
          name: catalogItems.name,
          brand: catalogItems.brand,
          weight: catalogItems.weight,
          weightUnit: catalogItems.weightUnit,
          price: catalogItems.price,
          ratingValue: catalogItems.ratingValue,
          productUrl: catalogItems.productUrl,
          categories: catalogItems.categories,
        })
        .from(catalogItems)
        .where(inArray(catalogItems.id, uniqueIds));

      const foundIds = new Set(items.map((it) => it.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return status(404, {
          error: `Catalog item(s) not found: ${missing.join(', ')}`,
        });
      }

      const rank = <K extends keyof (typeof items)[number]>(
        key: K,
        order: 'asc' | 'desc',
      ): number | null => {
        const ranked = [...items]
          .filter((it) => it[key] != null)
          .sort((a, b) => {
            const av = Number(a[key]);
            const bv = Number(b[key]);
            return order === 'asc' ? av - bv : bv - av;
          });
        return ranked[0]?.id ?? null;
      };

      return {
        items,
        lightestId: rank('weight', 'asc'),
        cheapestId: rank('price', 'asc'),
        highestRatedId: rank('ratingValue', 'desc'),
      };
    },
    {
      body: CatalogCompareRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Catalog'],
        summary: 'Compare 2–10 catalog items side-by-side',
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

      // Split large files into 20 MB byte-range chunks so each Worker
      // invocation stays within the CPU time budget (~30k rows / chunk).
      const CHUNK_BYTES = 20 * 1024 * 1024;
      const r2 = new R2BucketService({ env, bucketType: 'catalog' });
      const queueChunks: Array<{ objectKey: string; byteStart?: number; byteEnd?: number }> = [];

      for (const objectKey of chunks) {
        const meta = await r2.head(objectKey);
        if (!meta || meta.size <= CHUNK_BYTES) {
          queueChunks.push({ objectKey });
        } else {
          const n = Math.ceil(meta.size / CHUNK_BYTES);
          for (let i = 0; i < n; i++) {
            queueChunks.push({
              objectKey,
              byteStart: i * CHUNK_BYTES,
              byteEnd: Math.min((i + 1) * CHUNK_BYTES - 1, meta.size - 1),
            });
          }
        }
      }

      await queueCatalogETL({
        queue: env.ETL_QUEUE,
        chunks: queueChunks,
        jobId,
      });

      return {
        message: 'Catalog ETL job queued successfully',
        jobId,
        queued: true,
      };
    },
    {
      body: CatalogETLSchema,
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
        // Configuration error: surface as a 500 with a clear message
        throw new Error('Service unavailable: OpenAI API key not configured');
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

      return CatalogItemSchema.parse(newItem);
    },
    {
      body: CreateCatalogItemRequestSchema,
      response: { 200: CatalogItemSchema, 400: ErrorResponseSchema, 500: ErrorResponseSchema },
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
      if (
        !Number.isFinite(itemId) ||
        !Number.isInteger(itemId) ||
        itemId <= 0 ||
        itemId > 2147483647
      ) {
        throw new NotFoundError('Catalog item not found');
      }

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
        throw new NotFoundError('Catalog item not found');
      }

      const usageCount = item.packItems?.length || 0;
      const { packItems: _packItems, ...itemData } = item;
      return CatalogItemSchema.parse({ ...itemData, usageCount });
    },
    {
      params: z.object({ id: z.string() }),
      response: { 200: CatalogItemSchema },
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
      if (
        !Number.isFinite(itemId) ||
        !Number.isInteger(itemId) ||
        itemId <= 0 ||
        itemId > 2147483647
      ) {
        return status(404, { error: 'Catalog item not found or has no embedding' });
      }
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
      if (
        !Number.isFinite(itemId) ||
        !Number.isInteger(itemId) ||
        itemId <= 0 ||
        itemId > 2147483647
      ) {
        throw new NotFoundError('Catalog item not found');
      }
      const data = body;
      const { OPENAI_API_KEY, AI_PROVIDER, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
        getEnv();

      if (!OPENAI_API_KEY) {
        // Configuration error: surface as a 500 with a clear message
        throw new Error('Service unavailable: OpenAI API key not configured');
      }

      const existingItem = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, itemId),
      });

      if (!existingItem) {
        throw new NotFoundError('Catalog item not found');
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

      return CatalogItemSchema.parse(updatedItem);
    },
    {
      params: z.object({ id: z.string() }),
      body: UpdateCatalogItemRequestSchema,
      response: { 200: CatalogItemSchema, 400: ErrorResponseSchema, 500: ErrorResponseSchema },
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
      if (
        !Number.isFinite(itemId) ||
        !Number.isInteger(itemId) ||
        itemId <= 0 ||
        itemId > 2147483647
      ) {
        return status(404, { error: 'Catalog item not found' });
      }

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
