import { createDbClient } from '@packrat/api/db';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import type { Env } from '@packrat/api/utils/env-validation';
import { logger } from '@packrat/api/utils/logger';
import { etlJobs, type NewCatalogItem } from '@packrat/db';
import { isString } from '@packrat/guards';
import { eq, sql } from 'drizzle-orm';
import { CatalogService } from '../catalogService';
import { generateManyEmbeddings } from '../embeddingService';
import { mergeItemsBySku } from './mergeItemsBySku';
import { updateEtlJobProgress } from './updateEtlJobProgress';

export async function processValidItemsBatch({
  jobId,
  items,
  env,
}: {
  jobId: string;
  items: Partial<NewCatalogItem>[];
  env: Env;
}): Promise<void> {
  const catalogService = new CatalogService({ explicitEnv: env, useHttpDriver: true });

  const mergedItems = mergeItemsBySku(items as NewCatalogItem[]); // safe-cast: items are Partial<NewCatalogItem> at the type level, but all required fields have been confirmed present by CatalogItemValidator before reaching here

  // Source-text diff: skip OpenAI calls when an existing row has byte-identical
  // embedding-source text. Fixes the F4 embedding-regen anomaly (see
  // docs/brainstorms/2026-06-01-embedding-regen-anomaly-requirements.md):
  // previously every ETL row triggered a fresh embedding call regardless of
  // whether the source text had changed, costing OpenAI $$ + churning the
  // HNSW index on every re-ingest. text-embedding-3 is deterministic on
  // identical input, so reusing the existing embedding for unchanged rows
  // is byte-equivalent to regenerating.
  const existingBySku = await catalogService.fetchExistingForRegen(
    mergedItems.map((item) => item.sku).filter(isString),
  );

  // Partition: "needs fresh embedding" (new items + existing-but-changed) vs
  // "reuse existing embedding" (existing + source-text unchanged).
  type Partitioned =
    | { kind: 'fresh'; item: NewCatalogItem; sourceText: string }
    | { kind: 'reuse'; item: NewCatalogItem; existingEmbedding: number[] | null };

  const partitioned: Partitioned[] = mergedItems.map((item): Partitioned => {
    const existing = existingBySku.get(item.sku);
    if (!existing) {
      return { kind: 'fresh', item, sourceText: getEmbeddingText({ item }) };
    }
    const newText = getEmbeddingText({ item });
    const oldText = getEmbeddingText({ item: existing });
    if (newText !== oldText || !existing.embedding) {
      return { kind: 'fresh', item, sourceText: newText };
    }
    return { kind: 'reuse', item, existingEmbedding: existing.embedding };
  });

  const needFresh = partitioned.filter(
    (p): p is Extract<Partitioned, { kind: 'fresh' }> => p.kind === 'fresh',
  );

  logger.info({
    event: 'etl.embedding.diff',
    ctx: {
      jobId,
      total: mergedItems.length,
      fresh: needFresh.length,
      reused: partitioned.length - needFresh.length,
    },
  });

  try {
    // Generate embeddings only for the rows whose source text changed (or
    // are brand new). Skipped for the reuse-existing partition.
    const freshEmbeddings =
      needFresh.length > 0
        ? await generateManyEmbeddings({
            openAiApiKey: env.OPENAI_API_KEY,
            values: needFresh.map((p) => p.sourceText),
            cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
            cloudflareGatewayId: env.CLOUDFLARE_AI_GATEWAY_ID,
            cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
            provider: env.AI_PROVIDER,
            cloudflareAiBinding: env.AI,
          })
        : [];

    // Guard: any short response from generateManyEmbeddings would silently
    // write NULL embeddings for some fresh items, losing vector coverage on
    // them. Throw so the surrounding try/catch routes to the existing
    // "embedding generation failed" fallback path which records the failure
    // count on etl_jobs.total_embedding_failures.
    if (freshEmbeddings.length !== needFresh.length) {
      throw new Error(
        `generateManyEmbeddings returned ${freshEmbeddings.length} embeddings for ${needFresh.length} inputs`,
      );
    }

    // Combine items with their embeddings:
    //  - fresh partition: gets the newly-generated embedding (must be non-null,
    //    enforced by the length guard above)
    //  - reuse partition: gets `embedding: undefined` so the UPSERT's
    //    `embedding = COALESCE(excluded.embedding, catalog_items.embedding)`
    //    set clause preserves the stored vector without writing it back.
    //    text-embedding-3 is deterministic, so this is byte-equivalent to
    //    re-passing the existing embedding — minus the redundant write.
    let freshIndex = 0;
    const itemsWithEmbeddings = partitioned.map((p) => {
      if (p.kind === 'fresh') {
        const embedding = freshEmbeddings[freshIndex];
        freshIndex += 1;
        return { ...p.item, embedding };
      }
      return { ...p.item, embedding: undefined };
    });

    const upsertedItems = await catalogService.upsertCatalogItems(itemsWithEmbeddings);
    // Track the ETL job that processed these items
    await catalogService.trackEtlJob({ itemIds: upsertedItems, jobId });
    // Update the ETL job progress — processed is incremented atomically with valid to prevent
    // totalValid > totalProcessed if the Worker dies between two separate DB updates.
    await updateEtlJobProgress({
      env,
      params: {
        jobId,
        valid: items.length,
        processed: items.length,
      },
    });
  } catch (error) {
    // Embedding-fallback path. The upsert still happens (catalog gets the
    // items minus their vectors), but we record the degradation on
    // etl_jobs.total_embedding_failures so operators see the count via
    // the admin endpoint without trawling logs. Closes audit P2 #3.
    logger.warn({
      event: 'etl.embedding.fallback',
      ctx: {
        jobId,
        skuCount: items.length,
        errorName: error instanceof Error ? error.name : 'unknown',
      },
    });

    const upsertedItems = await catalogService.upsertCatalogItems(mergedItems);
    await catalogService.trackEtlJob({ itemIds: upsertedItems, jobId });
    await updateEtlJobProgress({
      env,
      params: {
        jobId,
        valid: items.length,
        processed: items.length,
      },
    });

    const db = createDbClient(env);
    await db
      .tag('etl.recordEmbeddingFailures')
      .update(etlJobs)
      .set({
        totalEmbeddingFailures: sql`COALESCE(${etlJobs.totalEmbeddingFailures}, 0) + ${items.length}`,
      })
      .where(eq(etlJobs.id, jobId));
  } finally {
    logger.info({ event: 'etl.valid_items.batch_complete', ctx: { jobId, count: items.length } });
  }
}
