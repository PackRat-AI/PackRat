import { createDb, createDbClient } from '@packrat/api/db';
import {
  type CatalogItem,
  catalogItemEtlJobs,
  catalogItems,
  type NewCatalogItem,
} from '@packrat/api/db/schema';
import { generateEmbedding, generateManyEmbeddings } from '@packrat/api/services/embeddingService';
import type { Env } from '@packrat/api/types/env';
import { getEnv } from '@packrat/api/utils/env-validation';
import {
  and,
  asc,
  cosineDistance,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { getEmbeddingText } from '../utils/embeddingHelper';

export class CatalogService {
  private db;
  private env: Env;

  /**
   * - `new CatalogService()` – reads the isolate-level env (Elysia routes).
   * - `new CatalogService(env, true)` – queue handler path: caller passes the
   *   raw validated env, and we use the HTTP-only Neon driver (which is
   *   better suited for short-lived queue workers).
   */
  constructor(explicitEnv?: Env, useHttpDriver: boolean = false) {
    if (explicitEnv && useHttpDriver) {
      this.env = explicitEnv;
      this.db = createDbClient(explicitEnv);
    } else if (explicitEnv) {
      this.env = explicitEnv;
      this.db = createDb();
    } else {
      this.env = getEnv();
      this.db = createDb();
    }
  }

  async getCatalogItems(params: {
    q?: string;
    limit?: number;
    offset?: number;
    category?: string;
    sort?: {
      field:
        | 'name'
        | 'brand'
        | 'category'
        | 'price'
        | 'ratingValue'
        | 'createdAt'
        | 'updatedAt'
        | 'usage';
      order: 'asc' | 'desc';
    };
  }): Promise<{
    items: CatalogItem[];
    total: number;
    limit: number;
    offset: number;
    nextOffset: number;
  }> {
    const { q, limit = 10, offset = 0, category, sort } = params;

    if (limit < 1) {
      throw new Error('Limit must be at least 1');
    }

    if (offset < 0) {
      throw new Error('Offset cannot be negative');
    }

    const conditions: SQL[] = [];
    if (q) {
      const searchCondition = or(
        ilike(catalogItems.name, `%${q}%`),
        ilike(catalogItems.description, `%${q}%`),
        ilike(catalogItems.brand, `%${q}%`),
        ilike(catalogItems.model, `%${q}%`),
        ilike(sql`${catalogItems.categories}::text`, `%${q}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (category) {
      conditions.push(sql`lower(${catalogItems.categories}::text) like lower(${`%${category}%`})`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build orderBy clause with usage as default
    let orderBy = [desc(sql`COALESCE(pack_item_counts.count, 0)`), desc(catalogItems.id)]; // default ordering by usage
    if (sort) {
      const { field, order } = sort;
      if (field === 'category') {
        orderBy = [
          order === 'desc'
            ? desc(sql`jsonb_array_elements_text(${catalogItems.categories})[0]`)
            : asc(sql`jsonb_array_elements_text(${catalogItems.categories})[0]`),
        ];
      } else if (field === 'usage') {
        orderBy = [
          order === 'desc'
            ? desc(sql`COALESCE(pack_item_counts.count, 0)`)
            : asc(sql`COALESCE(pack_item_counts.count, 0)`),
        ];
      } else {
        const sortColumn = catalogItems[field];
        if (sortColumn) {
          orderBy = [order === 'desc' ? desc(sortColumn) : asc(sortColumn)];
        }
      }
    }

    if (!limit) {
      const items = await this.db
        .select({
          ...getTableColumns(catalogItems),
          pack_item_count: sql<number>`COALESCE(pack_item_counts.count, 0)`,
        })
        .from(catalogItems)
        .leftJoin(
          sql`(
            SELECT catalog_item_id, COUNT(*) as count
            FROM pack_items 
            WHERE deleted = false
            GROUP BY catalog_item_id
          ) as pack_item_counts`,
          sql`pack_item_counts.catalog_item_id = ${catalogItems.id}`,
        )
        .where(where)
        .orderBy(...orderBy);

      return {
        items: items.map(({ pack_item_count, ...item }) => item),
        limit: items.length,
        total: items.length,
        offset: 0,
        nextOffset: items.length,
      };
    }

    const [itemsWithCounts, totalCountResult] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(catalogItems),
          pack_item_count: sql<number>`COALESCE(pack_item_counts.count, 0)`,
        })
        .from(catalogItems)
        .leftJoin(
          sql`(
            SELECT catalog_item_id, COUNT(*) as count
            FROM pack_items
            WHERE deleted = false
            GROUP BY catalog_item_id
          ) as pack_item_counts`,
          sql`pack_item_counts.catalog_item_id = ${catalogItems.id}`,
        )
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset),
      this.db.select({ totalCount: count() }).from(catalogItems).where(where),
    ]);
    const totalCount = totalCountResult[0]?.totalCount ?? 0;

    const items = itemsWithCounts.map(({ pack_item_count, ...item }) => item);

    return {
      items,
      total: Number(totalCount),
      limit,
      offset,
      nextOffset: offset + limit,
    };
  }

  async vectorSearch(
    q: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<{
    items: (Omit<CatalogItem, 'embedding'> & { similarity: number })[];
    total: number;
    limit: number;
    offset: number;
    nextOffset: number;
  }> {
    const { limit = 10, offset = 0 } = opts;
    if (!q || q.trim() === '') {
      return {
        items: [],
        total: 0,
        limit,
        offset,
        nextOffset: offset + limit,
      };
    }

    const embedding = await generateEmbedding({
      value: q,
      openAiApiKey: this.env.OPENAI_API_KEY,
      provider: this.env.AI_PROVIDER,
      cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: this.env.CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareAiBinding: this.env.AI,
    });

    if (!embedding) {
      return {
        items: [],
        total: 0,
        limit,
        offset,
        nextOffset: offset + limit,
      };
    }

    const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, embedding)})`;

    const { embedding: _embedding, ...columnsToSelect } = getTableColumns(catalogItems);

    const [items, vectorTotalCountResult] = await Promise.all([
      this.db
        .select({
          ...columnsToSelect,
          similarity,
        })
        .from(catalogItems)
        .where(gt(similarity, 0.1))
        .orderBy(desc(similarity))
        .limit(limit)
        .offset(offset),
      this.db
        .select({
          totalCount: count(),
        })
        .from(catalogItems)
        .where(gt(similarity, 0.1)),
    ]);
    const totalCount = vectorTotalCountResult[0]?.totalCount ?? 0;

    return {
      items,
      total: Number(totalCount),
      limit,
      offset,
      nextOffset: offset + limit,
    };
  }

  async batchVectorSearch(
    queries: string[],
    limit: number = 5,
  ): Promise<{
    items: (Omit<CatalogItem, 'embedding'> & { similarity: number })[][];
  }> {
    if (!queries || queries.length === 0) {
      return {
        items: [],
      };
    }

    const embeddings = await generateManyEmbeddings({
      values: queries,
      openAiApiKey: this.env.OPENAI_API_KEY,
      cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: this.env.CLOUDFLARE_AI_GATEWAY_ID,
      provider: this.env.AI_PROVIDER,
      cloudflareAiBinding: this.env.AI,
    });

    if (!embeddings) {
      return {
        items: [],
      };
    }

    const searchTasks = embeddings.map((embedding) => {
      if (!embedding) {
        return Promise.resolve([]);
      }

      const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, embedding)})`;
      const { embedding: _embedding, ...columnsToSelect } = getTableColumns(catalogItems);
      return this.db
        .select({
          ...columnsToSelect,
          similarity,
        })
        .from(catalogItems)
        .where(gt(similarity, 0.1))
        .orderBy(desc(similarity))
        .limit(limit);
    });

    const items = await Promise.all(searchTasks);

    return {
      items,
    };
  }

  async getCategories(limit = 10) {
    const rows = await this.db
      .select({
        category: sql<string>`jsonb_array_elements_text(${catalogItems.categories})`,
      })
      .from(catalogItems)
      .where(sql`${catalogItems.categories} IS NOT NULL`)
      .groupBy(sql`jsonb_array_elements_text(${catalogItems.categories})`)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((row) => String(row.category));
  }

  /**
   * Batch upsert catalog items:
   * - For each item, insert or update only non-empty fields
   */

  async upsertCatalogItems(items: NewCatalogItem[]): Promise<Pick<CatalogItem, 'id'>[]> {
    const columns = getTableColumns(catalogItems);

    const upsertedItems = await this.db
      .insert(catalogItems)
      .values(items)
      .onConflictDoUpdate({
        target: catalogItems.sku,
        set: Object.values(columns).reduce<Record<string, SQL>>((acc, col) => {
          acc[col.name] = sql.raw(`COALESCE(catalog_items.${col.name}, excluded."${col.name}")`);
          return acc;
        }, {}),
      })
      .returning();

    // Check if any embedding-related fields have changed
    const embeddingFields: Array<keyof CatalogItem> = [
      'name',
      'description',
      'categories',
      'brand',
    ];

    const itemsToUpdate = upsertedItems.filter((item) => {
      const inputItem = items.find((i) => i.sku === item.sku);
      if (!inputItem) return false;

      return embeddingFields.some(
        (field) =>
          inputItem[field] && JSON.stringify(inputItem[field]) !== JSON.stringify(item[field]),
      );
    });

    if (itemsToUpdate.length > 0) {
      // Regenerate embeddings for updated items
      const embeddingTexts = itemsToUpdate.map((item) => getEmbeddingText(item));
      const embeddings = await generateManyEmbeddings({
        openAiApiKey: this.env.OPENAI_API_KEY,
        values: embeddingTexts,
        cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: this.env.CLOUDFLARE_AI_GATEWAY_ID,
        provider: this.env.AI_PROVIDER,
        cloudflareAiBinding: this.env.AI,
      });

      // Update items with new embeddings
      const updatePromises = itemsToUpdate.map((item, index) =>
        this.db
          .update(catalogItems)
          .set({ embedding: embeddings[index] })
          .where(eq(catalogItems.sku, item.sku)),
      );

      await Promise.all(updatePromises);
    }

    return upsertedItems;
  }

  async trackEtlJob(itemIds: Pick<CatalogItem, 'id'>[], jobId: string): Promise<void> {
    await this.db.insert(catalogItemEtlJobs).values(
      itemIds.map((item) => ({
        catalogItemId: item.id,
        etlJobId: jobId,
      })),
    );
  }

  async queueEmbeddingJobs(): Promise<{ count: number }> {
    const BATCH_SIZE = 100;

    // Get count of items without embeddings
    const queueTotalCountResult = await this.db
      .select({ totalCount: count() })
      .from(catalogItems)
      .where(isNull(catalogItems.embedding));

    const total = Number(queueTotalCountResult[0]?.totalCount ?? 0);
    console.log(`Queuing ${total} items for embeddings`);

    if (total === 0) {
      return { count: 0 };
    }

    // Get items without embeddings
    const itemsWithoutEmbeddings = await this.db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(isNull(catalogItems.embedding));

    const totalBatches = Math.ceil(itemsWithoutEmbeddings.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const currentBatch = itemsWithoutEmbeddings.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      try {
        // Send batch of items to the embeddings queue
        await this.env.EMBEDDINGS_QUEUE.sendBatch(currentBatch.map((item) => ({ body: item })));
        console.log(`Queued batch ${i + 1}/${totalBatches}`);
      } catch (error) {
        console.error(`Failed to queue batch ${i + 1}/${totalBatches}:`, error);
        throw new Error(
          `Failed to queue batch ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    console.log(`Completed queuing ${total} items in ${totalBatches} batches`);
    return { count: total };
  }

  async handleEmbeddingsBatch(batch: MessageBatch): Promise<void> {
    const batchSize = batch.messages.length;
    console.log(`Processing batch: ${batchSize} items`);

    const itemsToEmbed = await this.db
      .select()
      .from(catalogItems)
      .where(
        inArray(
          catalogItems.id,
          batch.messages.map((message) => (message.body as { id: number }).id),
        ),
      );

    // Prepare texts for batch embedding
    const embeddingTexts = itemsToEmbed.map((item) => getEmbeddingText(item));

    try {
      // Generate embeddings in batch
      const embeddings = await generateManyEmbeddings({
        openAiApiKey: this.env.OPENAI_API_KEY,
        values: embeddingTexts,
        cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: this.env.CLOUDFLARE_AI_GATEWAY_ID,
        provider: this.env.AI_PROVIDER,
        cloudflareAiBinding: this.env.AI,
      });

      // Update items with embeddings
      for (let i = 0; i < itemsToEmbed.length; i++) {
        const item = itemsToEmbed[i];
        const embedding = embeddings[i];
        if (!item || embedding === undefined) continue;
        await this.db
          .update(catalogItems)
          .set({ embedding, updatedAt: new Date() })
          .where(eq(catalogItems.id, item.id));
      }

      console.log(`Completed batch: ${itemsToEmbed.length} embeddings generated`);
    } catch (error) {
      console.error('Embeddings batch failed:', error);
      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
