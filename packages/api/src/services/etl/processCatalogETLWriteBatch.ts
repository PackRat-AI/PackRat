import type { NewCatalogItem } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import { CatalogService } from '../catalogService';
import { generateManyEmbeddings } from '../embeddingService';
import { mergeItemsBySku } from './mergeItemsBySku';
import type { CatalogETLWriteBatchMessage } from './types';
import { updateEtlJobProgress } from './updateEtlJobProgress';

export async function processCatalogETLWriteBatch({
  message,
  env,
}: {
  message: CatalogETLWriteBatchMessage;
  env: Env;
}): Promise<void> {
  const jobId = message.id;
  const { items, total } = message.data;

  const catalogService = new CatalogService(env, false);

  // Consolidate items with identical SKUs before upserting to avoid conflicting duplicate upserts.
  const mergedItems = mergeItemsBySku(items as NewCatalogItem[]);

  // Prepare texts for batch embedding
  const embeddingTexts = mergedItems.map((item) => getEmbeddingText(item));

  try {
    // Generate embeddings in batch
    const embeddings = await generateManyEmbeddings({
      openAiApiKey: env.OPENAI_API_KEY,
      values: embeddingTexts,
      cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: env.CLOUDFLARE_AI_GATEWAY_ID,
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
    await catalogService.trackEtlJob(upsertedItems, jobId);
    // Update the ETL job progress
    await updateEtlJobProgress(env, jobId, {
      valid: items.length,
      total,
    });
  } catch (error) {
    console.error(`Error generating embeddings for batch ${jobId}:`, error);
    // Fall back to processing without embeddings
    const upsertedItems = await catalogService.upsertCatalogItems(mergedItems);
    await catalogService.trackEtlJob(upsertedItems, jobId);
    await updateEtlJobProgress(env, jobId, {
      valid: items.length,
      total,
    });
  } finally {
    console.log(`📦 Batch ${jobId}: Processed ${items.length} valid items`);
  }
}
