import type { Message, MessageBatch } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/types/env';
import type { BaseQueueMessage } from './etl/queue';
import { R2BucketService } from './r2-bucket';

interface LogQueueMessage extends BaseQueueMessage {
  logsDestination: string;
  logs: Array<{
    importId: string;
    errors: Array<{ reason: string }>;
    rawData: unknown;
    timestamp: number;
    rowIndex: number;
  }>;
}

export class LogsQueueConsumer {
  async handle(batch: MessageBatch<BaseQueueMessage>, env: Env): Promise<void> {
    const r2Service = new R2BucketService({
      env,
      bucketType: 'catalog',
    });

    for (const message of batch.messages) {
      const { logsDestination, logs } = (message as Message<LogQueueMessage>).body;

      try {
        const jsonlContent = logs.map((log) => JSON.stringify(log)).join('\n');

        await r2Service.put(logsDestination, jsonlContent, {
          httpMetadata: {
            contentType: 'application/json-lines',
          },
        });

        console.log(`📝 Processed and wrote ${logs.length} invalid items to ${logsDestination}`);
      } catch (error) {
        console.error(`Failed to process log message:`, error);
      }
    }
  }
}
