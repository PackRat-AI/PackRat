import type { Queue } from '@cloudflare/workers-types';

export interface CatalogETLMessage {
  timestamp: number;
  id: string;
  data: {
    objectKey: string;
    userId: string;
    source: string;
    scraperRevision: string;
    startRow?: number; // for chunking
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
