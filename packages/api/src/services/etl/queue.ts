import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/types/env';
import { processCatalogETL } from './processCatalogEtl';
import type { CatalogETLMessage } from './types';

export async function queueCatalogETL({
  queue,
  objectKeys,
  jobId,
}: {
  queue: Queue;
  objectKeys: string[];
  jobId: string;
}): Promise<string> {
  const promises: Promise<void>[] = [];

  const batchSize = 100; // maximum batch size Cloudflare allows
  let batch: { body: CatalogETLMessage }[] = [];

  for (const objectKey of objectKeys) {
    if (batch.length === batchSize) {
      promises.push(queue.sendBatch(batch));
      batch = [];
    }

    const message: CatalogETLMessage = {
      data: { objectKey },
      timestamp: Date.now(),
      id: jobId,
    };
    batch.push({ body: message });
  }

  if (batch.length > 0) {
    promises.push(queue.sendBatch(batch));
  }

  await Promise.all(promises);

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
