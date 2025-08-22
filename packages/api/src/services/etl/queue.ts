import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import type { Env } from '@packrat/api/utils/env-validation';
import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { CatalogService } from '../catalogService';
import { generateManyEmbeddings } from '../embeddingService';
import { R2BucketService } from '../r2-bucket';
import { CatalogItemValidator } from './CatalogItemValidator';
import { mergeItemsBySku } from './mergeItemsBySku';
import { processCatalogETLWriteBatch } from './processCatalogETLWriteBatch';
import { processCatalogETL } from './processCatalogEtl';
import type { CatalogETLWriteBatchMessage } from './types';

export enum QueueType {
  CATALOG_ETL = 'catalog-etl',
  CATALOG_ETL_WRITE_BATCH = 'catalog-etl-write-batch',
}

export interface BaseQueueMessage {
  type: QueueType;
  timestamp: number;
  id: string;
}

export interface CatalogETLMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL;
  data: {
    objectKey: string;
    userId: string;
    source: string;
    scraperRevision: string;
    startRow?: number; // for chunking
  };
}

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
    type: QueueType.CATALOG_ETL,
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
  batch: MessageBatch<BaseQueueMessage>;
  env: Env;
}): Promise<void> {
  for (const message of batch.messages) {
    try {
      const queueMessage: BaseQueueMessage = message.body;

      switch (queueMessage.type) {
        case QueueType.CATALOG_ETL:
          await processCatalogETL({
            message: queueMessage as CatalogETLMessage,
            env,
          });
          break;

        case QueueType.CATALOG_ETL_WRITE_BATCH:
          await processCatalogETLWriteBatch({
            message: queueMessage as CatalogETLWriteBatchMessage,
            env,
          });
          break;

        default:
          console.warn(`Unknown queue message type: ${queueMessage.type}`);
      }
    } catch (error) {
      console.error('Error processing queue message:', error);
    }
  }
}
