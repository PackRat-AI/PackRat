import type { MessageBatch } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/utils/env-validation';
import { createDbClient } from '../db';
import { invalidItemLogs, type NewInvalidItemLog } from '../db/schema';
import { updateEtlJobProgress } from './etl/updateEtlJobProgress';

export class LogsQueueConsumer {
  async handle(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const db = createDbClient(env);

    for (const message of batch.messages) {
      const { id: jobId, data: logs } = message.body as { id: string; data: NewInvalidItemLog[] };

      try {
        await db.insert(invalidItemLogs).values(logs);
        await updateEtlJobProgress(env, {
          jobId,
          invalid: logs.length,
        });

        console.log(`📝 Processed and wrote ${logs.length} invalid items for job ${jobId}`);
      } catch (error) {
        console.error(`Failed to process log message:`, error);
      }
    }
  }
}
