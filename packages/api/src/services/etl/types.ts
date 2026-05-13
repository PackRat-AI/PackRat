import type { Queue } from '@cloudflare/workers-types';

export interface CatalogETLMessage {
  timestamp: number;
  id: string;
  data: {
    objectKey: string;
    byteStart?: number;
    byteEnd?: number;
  };
}

export interface QueueCatalogETLParams {
  queue: Queue;
  chunks: Array<{ objectKey: string; byteStart?: number; byteEnd?: number }>;
  jobId: string;
}
