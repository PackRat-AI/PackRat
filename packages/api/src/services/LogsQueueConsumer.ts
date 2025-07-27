import type { MessageBatch } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/types/env';
import { createDbClient } from '../db';
import { invalidItemLogs, type NewInvalidItemLog } from '../db/schema';

export class LogsQueueConsumer {
  async handle(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const db = createDbClient(env);

    for (const message of batch.messages) {
      const logs = message.body as NewInvalidItemLog[];

      try {
        await db.insert(invalidItemLogs).values(logs);

        console.log(`📝 Processed and wrote ${logs.length} invalid items for job ${logs[0].jobId}`);
      } catch (error) {
        console.error(`Failed to process log message:`, error);
      }
    }
  }
}
