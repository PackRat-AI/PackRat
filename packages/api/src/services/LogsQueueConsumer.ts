import type { MessageBatch } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/types/env';
import { createDbClient } from '../db';
import { invalidItemLogs, type NewInvalidItemLog } from '../db/schema';
import { updateEtlJobProgress } from './etl/updateEtlJobProgress';

export class LogsQueueConsumer {
  async handle(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const db = createDbClient(env);

    for (const message of batch.messages) {
      const {
        id: jobId,
        totalItemsCount,
        data: logs,
      } = message.body as { id: string; totalItemsCount: number; data: NewInvalidItemLog[] };

      try {
        await db.insert(invalidItemLogs).values(logs);
        await updateEtlJobProgress(env, jobId, {
          invalid: logs.length,
          total: totalItemsCount,
        });

        console.log(`📝 Processed and wrote ${logs.length} invalid items for job ${jobId}`);
      } catch (error) {
        console.error(`Failed to process log message:`, error);
      }
    }
  }
}
