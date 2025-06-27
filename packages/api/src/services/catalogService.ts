import {
  cosineDistance,
  desc,
  getTableColumns,
  gt,
  sql,
  count,
  or,
  ilike,
  eq,
  and,
} from 'drizzle-orm';
import type { Context } from 'hono';
import { env } from 'hono/adapter';
import { createDb } from '@packrat/api/db';
import { type CatalogItem, catalogItems } from '@packrat/api/db/schema';
import { generateEmbedding } from '@packrat/api/services/embeddingService';
import type { Env } from '@packrat/api/types/env';

export class CatalogService {
  private db;
  private env;

  constructor(c: Context) {
    this.db = createDb(c);
    this.env = env<Env>(c);
  }

  async getCatalogItems(params: {
    q?: string;
    limit?: number;
    offset?: number;
    category?: string;
  }): Promise<{
    items: CatalogItem[];
    total: number;
    limit: number;
    offset: number;
    nextOffset: number;
  }> {
    const { q, limit = 10, offset = 0, category } = params;

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

    if (!limit) {
      const items = await this.db.query.catalogItems.findMany({
        where,
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
        limit: limit,
        offset,
        orderBy: [desc(catalogItems.id)],
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
}
