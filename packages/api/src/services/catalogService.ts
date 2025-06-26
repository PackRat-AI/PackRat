import {
  cosineDistance,
  desc,
  getTableColumns,
  gt,
  sql,
  count,
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

  async semanticSearch(
    q: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    items: (CatalogItem & { similarity: number })[];
    total: number;
    limit: number;
    offset: number;
  }> {
    if (!q || q.trim() === '') {
      return {
        items: [],
        total: 0,
        limit,
        offset,
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
    };
  }
}
