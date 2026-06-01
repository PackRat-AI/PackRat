import { createDbClient } from '@packrat/api/db';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import type { Env } from '@packrat/api/utils/env-validation';
import { logger } from '@packrat/api/utils/logger';
import { etlJobs, type NewCatalogItem } from '@packrat/db';
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

  // Prepare texts for batch embedding
  const embeddingTexts = mergedItems.map((item) => getEmbeddingText({ item }));

  try {
    // Generate embeddings in batch
    const embeddings = await generateManyEmbeddings({
      openAiApiKey: env.OPENAI_API_KEY,
      values: embeddingTexts,
      cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: env.CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
      provider: env.AI_PROVIDER,
      cloudflareAiBinding: env.AI,
    });

    // Combine items with their embeddings
    const itemsWithEmbeddings = mergedItems.map((item, index) => ({
      ...item,
      embedding: embeddings[index],
    }));

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
    logger.warn('etl.embedding.fallback', {
      jobId,
      skuCount: items.length,
      errorName: error instanceof Error ? error.name : 'unknown',
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
      .update(etlJobs)
      .set({
        totalEmbeddingFailures: sql`COALESCE(${etlJobs.totalEmbeddingFailures}, 0) + ${items.length}`,
      })
      .where(eq(etlJobs.id, jobId));
  } finally {
    logger.info('etl.valid_items.batch_complete', { jobId, count: items.length });
  }
}
