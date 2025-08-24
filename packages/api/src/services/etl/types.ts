import type { Queue } from '@cloudflare/workers-types';
import type { NewCatalogItem } from '@packrat/api/db/schema';

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
    startRow?: number;
  };
}

export interface CatalogETLWriteBatchMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL_WRITE_BATCH;
  data: {
    items: Partial<NewCatalogItem>[];
  };
}

export interface QueueCatalogETLParams {
  queue: Queue;
  objectKey: string;
  userId: string;
  source: string;
  scraperRevision: string;
  startRow?: number;
}
