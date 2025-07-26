import { createDb, createDbClient } from '@packrat/api/db';
import {
  type CatalogItem,
  catalogItemEtlJobs,
  catalogItems,
  type NewCatalogItem,
} from '@packrat/api/db/schema';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import type { Env } from '@packrat/api/types/env';
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
  isNotNull,
  or,
  sql,
} from 'drizzle-orm';
import type { Context } from 'hono';
import { env } from 'hono/adapter';
import { filterNonEmptyFields } from '../utils/filterNonEmptyFields';

const isContext = (contextOrEnv: Context | Env, isContext: boolean): contextOrEnv is Context =>
  isContext;

export class CatalogService {
  private db;
  private env;

  constructor(contextOrEnv: Context | Env, isHonoContext: boolean = true) {
    if (isContext(contextOrEnv, isHonoContext)) {
      this.db = createDb(contextOrEnv);
      this.env = env<Env>(contextOrEnv);
    } else {
      this.db = createDbClient(contextOrEnv);
      this.env = contextOrEnv;
    }
  }

  async getCatalogItems(params: {
    q?: string;
    limit?: number;
    offset?: number;
    category?: string;
    sort?: {
      field: 'name' | 'brand' | 'category' | 'price' | 'ratingValue' | 'createdAt' | 'updatedAt';
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
    console.log(params);

    if (limit < 1) {
      throw new Error('Limit must be at least 1');
    }

    if (offset < 0) {
      throw new Error('Offset cannot be negative');
    }

    const conditions = [];
    if (q) {
      conditions.push(
        or(
          ilike(catalogItems.name, `%${q}%`),
          ilike(catalogItems.description, `%${q}%`),
          ilike(catalogItems.brand, `%${q}%`),
          ilike(catalogItems.model, `%${q}%`),
          ilike(catalogItems.category, `%${q}%`),
        ),
      );
    }

    if (category) {
      conditions.push(eq(catalogItems.category, category));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build orderBy clause
    let orderBy = [desc(catalogItems.id)]; // default ordering
    if (sort) {
      const { field, order } = sort;
      const sortColumn = catalogItems[field];
      if (sortColumn) {
        orderBy = [order === 'desc' ? desc(sortColumn) : asc(sortColumn)];
      }
    }
    console.log(orderBy);

    if (!limit) {
      const items = await this.db.query.catalogItems.findMany({
        where,
        orderBy,
      });
      return {
        items,
        limit: items.length,
        total: items.length,
        offset: 0,
        nextOffset: items.length,
      };
    }

    const [items, [{ totalCount }]] = await Promise.all([
      this.db.query.catalogItems.findMany({
        where,
        limit,
        offset,
        orderBy,
      }),
      this.db.select({ totalCount: count() }).from(catalogItems).where(where),
    ]);

    return {
      items,
      total: Number(totalCount),
      limit,
      offset,
      nextOffset: offset + limit,
    };
  }

  async semanticSearch(
    q: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{
    items: (CatalogItem & { similarity: number })[];
    total: number;
    limit: number;
    offset: number;
    nextOffset: number;
  }> {
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
    });

    const similarity = sql<number>`1 - (${cosineDistance(catalogItems.embedding, embedding)})`;

    const [items, [{ totalCount }]] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(catalogItems),
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

    return {
      items,
      total: Number(totalCount),
      limit,
      offset,
      nextOffset: offset + limit,
    };
  }

  async getCategories(limit = 10) {
    const rows = await this.db
      .select({
        category: catalogItems.category,
      })
      .from(catalogItems)
      .where(isNotNull(catalogItems.category))
      .groupBy(catalogItems.category)
      .orderBy(desc(count(catalogItems.id)))
      .limit(limit);

    return rows.map((row) => row.category);
  }

  /**
   * Batch upsert catalog items:
   * - For each item, insert or update only non-empty fields
   */
  async upsertCatalogItems(items: NewCatalogItem[], etlJobId: string): Promise<void> {
    for (const item of items) {
      const insertData = item;
      const updateData = filterNonEmptyFields(item);

      // Insert or update the catalog item
      const [catalogItem] = await this.db
        .insert(catalogItems)
        .values(insertData)
        .onConflictDoUpdate({
          target: catalogItems.sku,
          set: updateData,
        })
        .returning({ id: catalogItems.id });

      // Associate the catalog item with the ETL job
      await this.db.insert(catalogItemEtlJobs).values({
        catalogItemId: catalogItem.id,
        etlJobId,
      });
    }
  }
}
