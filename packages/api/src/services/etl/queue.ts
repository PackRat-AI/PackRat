import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/types/env';
import { processCatalogETL } from './processCatalogEtl';
import type { CatalogETLMessage } from './types';

export async function queueCatalogETL({
  queue,
  objectKey,
  userId,
  source,
  scraperRevision,
  jobId,
  startRow = 0, // <-- Default to 0
}: {
  queue: Queue;
  objectKey: string;
  userId: string;
  source: string;
  scraperRevision: string;
  jobId: string;
  startRow?: number;
}): Promise<string> {
  const message: CatalogETLMessage = {
    data: { objectKey, userId, source, scraperRevision, startRow },
    timestamp: Date.now(),
    id: jobId,
  };

  await queue.send(message);
  return jobId;
}

export async function processQueueBatch({
  batch,
  env,
}: {
  batch: MessageBatch<CatalogETLMessage>;
  env: Env;
}): Promise<void> {
  for (const message of batch.messages) {
    try {
      const queueMessage: CatalogETLMessage = message.body;
      await processCatalogETL({
        message: queueMessage,
        env,
      });
    } catch (error) {
      console.error('Error processing queue message:', error);
    }
  }
}
