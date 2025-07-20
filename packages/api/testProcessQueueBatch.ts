import fs from 'fs';
import { parse } from 'csv-parse/sync';
// import { processQueueBatch } from '../packages/api/src/services/queue';
// import type { Env } from '../packages/api/src/types/env';
// import type { CatalogETLMessage, QueueType } from '../packages/api/src/services/queue';
import { CatalogETLMessage, processQueueBatch, QueueType, processCatalogETLWriteBatch } from './src/services/queue';
import type { Env } from './src/types/env';

const csvPath = 'imported_data/v2_hydrapak_hydrapak_2025-07-15T07-32-37.csv'; 
const csv = fs.readFileSync(csvPath, 'utf8');
const records = parse(csv, { skip_empty_lines: true });

// Mock the queue message
const message: CatalogETLMessage = {
  type: QueueType.CATALOG_ETL,
  timestamp: Date.now(),
  id: 'test-job-id',
  data: {
    objectKey: 'test-object-key',
    userId: 'test-user-id',
    filename: csvPath,
  },
};

// Mock the batch
const batch = {
  messages: [{ body: message }],
};

// Mock env (add any required bindings)
const env: Env = {
  NEON_DATABASE_URL:"postgresql://packrat:packrat@localhost:5455/testdb",
  PACKRAT_ITEMS_BUCKET: {
    async get(objectKey: string) {
      return {
        async text() {
          return csv;
        }
      };
    }
  } as any,
  ETL_QUEUE: {
    async send(message: any) {
      // Directly call processCatalogETLWriteBatch for testing
      if (message.type === QueueType.CATALOG_ETL_WRITE_BATCH) {
        await processCatalogETLWriteBatch({ message, env });
      }
    }
  } as any,
};

(async () => {
  await processQueueBatch({ batch, env });
  console.log('processQueueBatch finished!');
})();
