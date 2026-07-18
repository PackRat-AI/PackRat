import { createDb } from '@packrat/api/db';
import { apiKeyAuthPlugin, authPlugin } from '@packrat/api/middleware/auth';
import { CatalogService } from '@packrat/api/services';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import { queueCatalogETL } from '@packrat/api/services/etl/queue';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { buildInstanceId } from '@packrat/api/utils/buildInstanceId';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { getEnv, isLocalE2EApiEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import type { CatalogEtlWorkflowParams } from '@packrat/api/workflows/catalog-etl-workflow';
import { type ChunkSpec, chunkCsvForR2 } from '@packrat/api/workflows/shared/chunkCsvForR2';
import { catalogItems, etlJobs, packItems } from '@packrat/db';
import { isNumber, isObject, isString } from '@packrat/guards';
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
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
import { Elysia, NotFoundError, status } from 'elysia';
import { z } from 'zod';

const isLocalE2ECatalogEnv = () => {
  const { NEON_DATABASE_URL, OPENAI_API_KEY } = getEnv();
  return isLocalE2EApiEnv({
    databaseUrl: NEON_DATABASE_URL,
    openAiApiKey: OPENAI_API_KEY,
    requireStubOpenAI: true,
  });
};

const localE2ECatalogItems = [
  {
    id: 7001,
    name: 'Copper Spur HV UL2 Tent',
    productUrl: 'https://example.test/catalog/copper-spur',
    sku: 'E2E-COPPER-SPUR',
    weight: 1420,
    weightUnit: 'g',
    description:
      'Freestanding two-person backpacking tent used for deterministic local E2E search.',
    categories: ['shelter', 'backpacking'],
    images: [] as string[],
    brand: 'Big Agnes',
    model: 'Copper Spur HV UL2',
    ratingValue: 4.8,
    color: 'Orange',
    size: '2 person',
    price: 549.95,
    availability: 'in_stock',
    seller: 'PackRat E2E',
    productSku: 'E2E-COPPER-SPUR',
    material: 'Nylon',
    currency: 'USD',
    condition: 'new',
    reviewCount: 42,
    usageCount: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    similarity: 0.92,
  },
  {
    id: 7002,
    name: 'Hyperlite 40L Pack',
    productUrl: 'https://example.test/catalog/hyperlite-40',
    sku: 'E2E-HYPERLITE-40',
    weight: 910,
    weightUnit: 'g',
    description: 'Lightweight framed pack fixture for local E2E similar gear results.',
    categories: ['pack', 'backpacking'],
    images: [] as string[],
    brand: 'Hyperlite',
    model: '40L',
    ratingValue: 4.6,
    color: 'White',
    size: '40 L',
    price: 379,
    availability: 'in_stock',
    seller: 'PackRat E2E',
    productSku: 'E2E-HYPERLITE-40',
    material: 'Dyneema composite',
    currency: 'USD',
    condition: 'new',
    reviewCount: 27,
    usageCount: 5,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    similarity: 0.84,
  },
];

export const catalogRoutes = new Elysia({ prefix: '/catalog' })
  .model({
    'catalog.CatalogCategoriesResponse': CatalogCategoriesResponseSchema,
    'catalog.CatalogCompareRequest': CatalogCompareRequestSchema,
    'catalog.CatalogETL': CatalogETLSchema,
    'catalog.CatalogItem': CatalogItemSchema,
    'catalog.CatalogItemsResponse': CatalogItemsResponseSchema,
    'catalog.CreateCatalogItemRequest': CreateCatalogItemRequestSchema,
    'catalog.UpdateCatalogItemRequest': UpdateCatalogItemRequestSchema,
    'catalog.ErrorResponse': ErrorResponseSchema,
  })
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
      response: { 200: 'catalog.CatalogItemsResponse' },
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
        if (isLocalE2ECatalogEnv()) {
          const normalizedQuery = searchQuery.trim().toLowerCase();
          const matched = localE2ECatalogItems.filter((item) => {
            const haystack = [
              item.name,
              item.brand,
              item.model,
              item.description,
              ...(item.categories ?? []),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(normalizedQuery) || normalizedQuery.length === 0;
          });
          const items = matched.slice(offset, offset + limit);

          return {
            items,
            total: matched.length,
            limit,
            offset,
            nextOffset: offset + items.length,
          };
        }

        const catalogService = new CatalogService();
        return await catalogService.vectorSearch({ q: searchQuery, opts: { limit, offset } });
      } catch (error) {
        captureApiException({ error, operation: 'catalog.vectorSearch' });
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
      response: { 200: 'catalog.CatalogCategoriesResponse' },
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
        .tag('catalog.compare')
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

      const rank = <K extends keyof (typeof items)[number]>({
        key,
        order,
      }: {
        key: K;
        order: 'asc' | 'desc';
      }): number | null => {
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
        lightestId: rank({ key: 'weight', order: 'asc' }),
        cheapestId: rank({ key: 'price', order: 'asc' }),
        highestRatedId: rank({ key: 'ratingValue', order: 'desc' }),
      };
    },
    {
      body: 'catalog.CatalogCompareRequest',
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
        .tag('catalog.embeddingsStats')
        .select({ totalCount: count() })
        .from(catalogItems)
        .where(isNull(catalogItems.embedding));
      const withoutEmbeddings = result[0]?.totalCount ?? 0;
      const totalItemsResult = await db
        .tag('catalog.embeddingsStats')
        .select({ totalCount: count() })
        .from(catalogItems);
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

  // -- ETL trigger (api-key auth)
  //
  // Default engine is 'workflow' — triggers a CatalogEtlWorkflow instance
  // per source file. The 'queue' engine routes to the legacy queue path and
  // remains available during the coexistence window so operators can fall
  // back if the workflow path misbehaves in production. The queue path will
  // be removed after the workflow path bakes (per the migration plan).
  .post(
    '/etl',
    async ({ body, query }) => {
      const { filename, chunks, source, scraperRevision } = body;
      const engine = query.engine ?? 'workflow';
      // chunkMiB lets the caller tune chunk size per-source without a deploy.
      // Both workflow and queue paths default to 2 MiB when omitted.
      const chunkBytes = query.chunkMiB !== undefined ? query.chunkMiB * 1024 * 1024 : undefined;
      const db = createDb();
      const env = getEnv();
      const jobId = crypto.randomUUID();

      if (engine === 'queue') {
        if (!env.ETL_QUEUE) {
          return status(400, { message: 'ETL_QUEUE is not configured' });
        }

        await db.tag('catalog.etlCreateJob').insert(etlJobs).values({
          id: jobId,
          status: 'running',
          source,
          filename,
          scraperRevision,
          startedAt: new Date(),
        });

        const CHUNK_BYTES = chunkBytes ?? 2 * 1024 * 1024; // 2 MiB default (matches workflow path)
        const r2 = new R2BucketService({ env, bucketType: 'catalog' });
        const queueChunks: Array<{
          objectKey: string;
          byteStart?: number;
          byteEnd?: number;
        }> = [];

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
          message: 'Catalog ETL job queued successfully (legacy queue path)',
          jobId,
          engine: 'queue' as const,
        };
      }

      // Workflow path (default).
      if (!env.ETL_WORKFLOW) {
        return status(400, { message: 'ETL_WORKFLOW is not configured' });
      }

      const r2 = new R2BucketService({ env, bucketType: 'catalog' });

      // Chunk every source object up front so the workflow params carry the
      // full plan. Single-file is the dominant case in prod (scrapers
      // produce one CSV per run); multi-object requests bundle into one
      // workflow instance. ETag from the first object is captured for the
      // repair-from-scratch fail-closed verification (U5 follow-up).
      const allChunks: ChunkSpec[] = [];
      let firstEtag: string | null = null;
      let firstLastModified: Date | null = null;
      for (const objectKey of chunks) {
        const {
          etag,
          lastModified,
          chunks: chunkSpecs,
        } = await chunkCsvForR2({
          r2,
          objectKey,
          ...(chunkBytes !== undefined && { chunkBytes }),
        });
        if (firstEtag === null) {
          firstEtag = etag;
          firstLastModified = lastModified;
        }
        allChunks.push(...chunkSpecs);
      }

      // Re-index chunkIndex / chunksTotal across the combined chunk array so
      // step names in the workflow are globally unique within an instance.
      const totalChunks = allChunks.length;
      const indexedChunks: ChunkSpec[] = allChunks.map((c, i) => ({
        ...c,
        chunkIndex: i,
        chunksTotal: totalChunks,
      }));

      // CF Workflows instance IDs must match ^[a-zA-Z0-9_][a-zA-Z0-9-_]*$ — the
      // freeform filename is sanitized (extension stripped, disallowed chars
      // replaced, leading char guaranteed valid) before it's combined with source.
      const instanceId = buildInstanceId(`${source}-${filename}`);

      await db.tag('catalog.etlCreateJob').insert(etlJobs).values({
        id: jobId,
        status: 'running',
        source,
        filename,
        scraperRevision,
        startedAt: new Date(),
        workflowInstanceId: instanceId,
        sourceEtag: firstEtag,
        sourceLastModified: firstLastModified,
      });

      const params: CatalogEtlWorkflowParams = {
        jobId,
        source,
        scraperRevision,
        chunks: indexedChunks,
      };

      try {
        await env.ETL_WORKFLOW.create({ id: instanceId, params });
      } catch (err) {
        await db
          .tag('catalog.etlUpdateJobStatus')
          .update(etlJobs)
          .set({ status: 'failed', completedAt: new Date() })
          .where(eq(etlJobs.id, jobId));
        throw err;
      }

      return {
        message: 'Catalog ETL workflow triggered',
        jobId,
        engine: 'workflow' as const,
        workflowInstanceId: instanceId,
      };
    },
    {
      body: 'catalog.CatalogETL',
      query: z.object({
        engine: z.enum(['workflow', 'queue']).optional(),
        chunkMiB: z.coerce.number().int().min(1).max(20).optional(),
      }),
      isValidApiKey: true,
      detail: {
        tags: ['Catalog'],
        summary:
          'Trigger catalog ETL ingest (Workflow by default; ?engine=queue for legacy path). ' +
          'Pass ?chunkMiB=N to override the default 2 MiB chunk size (1–20 MiB).',
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
      const parsed = CreateCatalogItemRequestSchema.safeParse(body);
      if (!parsed.success) return status(400, { error: 'Validation failed' });

      const db = createDb();
      const data = parsed.data;
      const {
        OPENAI_API_KEY,
        AI_PROVIDER,
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_AI_GATEWAY_ID,
        CLOUDFLARE_API_TOKEN,
        AI,
      } = getEnv();

      const embeddingText = getEmbeddingText({ item: data });
      const embedding = await generateEmbedding({
        openAiApiKey: OPENAI_API_KEY,
        value: embeddingText,
        provider: AI_PROVIDER,
        cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
        cloudflareApiToken: CLOUDFLARE_API_TOKEN,
        cloudflareAiBinding: AI,
      });

      const [newItem] = await db
        .tag('catalog.create')
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
        .returning(); // lint:allow-unprojected-fat-table reason: POST returns full item to client via CatalogItemSchema.parse; defer narrowing to Tier-3 #13 (response-schema split)

      return CatalogItemSchema.parse(newItem);
    },
    {
      body: 'catalog.CreateCatalogItemRequest',
      response: {
        200: 'catalog.CatalogItem',
        400: 'catalog.ErrorResponse',
        500: 'catalog.ErrorResponse',
      },
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

      const item = await db.tag('catalog.getById').query.catalogItems.findFirst({
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
      response: { 200: 'catalog.CatalogItem' },
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

      const sourceItem = await db.tag('catalog.getSimilarSource').query.catalogItems.findFirst({
        // lint:allow-unprojected-fat-table reason: needs embedding column for vector ORDER BY below; defer narrowing to pivot migration (separate catalog_item_embeddings table)
        where: eq(catalogItems.id, itemId),
      });

      if (!sourceItem?.embedding) {
        return status(404, { error: 'Catalog item not found or has no embedding' });
      }

      // HNSW-eligible: ORDER BY raw distance ASC. The `similarity = 1 - distance`
      // field is preserved in the response, but the operators see the raw
      // distance so the planner can use embedding_idx (HNSW). Threshold
      // mechanically flips from `similarity > T` to `distance < (1 - T)`.
      const distance = cosineDistance(catalogItems.embedding, sourceItem.embedding);
      const similarity = sql<number>`1 - (${distance})`;
      const maxDistance = 1 - threshold;
      const { embedding: _embedding, ...columnsToSelect } = getTableColumns(catalogItems);

      const similarItems = await db
        .tag('catalog.getSimilarItems')
        .select({ ...columnsToSelect, similarity })
        .from(catalogItems)
        .where(
          and(
            sql`${distance} < ${maxDistance}`,
            ne(catalogItems.id, itemId),
            isNotNull(catalogItems.embedding),
          ),
        )
        .orderBy(distance)
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
      if (!body || (isObject(body) && Object.keys(body).length === 0)) {
        return status(400, { error: 'Validation failed' });
      }
      if (isObject(body) && 'issues' in body && Array.isArray(body.issues)) {
        return status(400, { error: 'Validation failed' });
      }
      if (isObject(body) && 'weight' in body && (!isNumber(body.weight) || body.weight <= 0)) {
        return status(400, { error: 'Validation failed' });
      }
      const parsed = UpdateCatalogItemRequestSchema.safeParse(body);
      if (!parsed.success) return status(400, { error: 'Validation failed' });

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
      const data = parsed.data;
      const {
        OPENAI_API_KEY,
        AI_PROVIDER,
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_AI_GATEWAY_ID,
        CLOUDFLARE_API_TOKEN,
        AI,
      } = getEnv();

      const existingItem = await db.tag('catalog.update').query.catalogItems.findFirst({
        // lint:allow-unprojected-fat-table reason: needs full row for getEmbeddingText diff (reads variants/techs/reviews/qas/faqs); defer to pivot migration
        where: eq(catalogItems.id, itemId),
      });

      if (!existingItem) {
        throw new NotFoundError('Catalog item not found');
      }

      let embedding: number[] | null = null;
      const newEmbeddingText = getEmbeddingText({ item: data, existingItem });
      const oldEmbeddingText = getEmbeddingText({ item: existingItem });

      if (newEmbeddingText !== oldEmbeddingText) {
        embedding = await generateEmbedding({
          openAiApiKey: OPENAI_API_KEY,
          value: newEmbeddingText,
          provider: AI_PROVIDER,
          cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
          cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
          cloudflareApiToken: CLOUDFLARE_API_TOKEN,
          cloudflareAiBinding: AI,
        });
      }

      const updateData: Partial<typeof catalogItems.$inferInsert> = { ...data };
      if (embedding) updateData.embedding = embedding;
      updateData.updatedAt = new Date();

      const [updatedItem] = await db
        .tag('catalog.update')
        .update(catalogItems)
        .set(updateData)
        .where(eq(catalogItems.id, itemId))
        .returning(); // lint:allow-unprojected-fat-table reason: PUT returns full updated item to client; defer narrowing to Tier-3 #13 (response-schema split)

      return CatalogItemSchema.parse(updatedItem);
    },
    {
      params: z.object({ id: z.string() }),
      body: 'catalog.UpdateCatalogItemRequest',
      response: {
        200: 'catalog.CatalogItem',
        400: 'catalog.ErrorResponse',
        500: 'catalog.ErrorResponse',
      },
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

      const existingItem = await db.tag('catalog.delete').query.catalogItems.findFirst({
        // lint:allow-unprojected-fat-table reason: existence check only — could narrow to {id} but bundling with pivot migration to touch each callsite once
        where: eq(catalogItems.id, itemId),
      });

      if (!existingItem) {
        return status(404, { error: 'Catalog item not found' });
      }

      await db.tag('catalog.delete').delete(catalogItems).where(eq(catalogItems.id, itemId));
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
