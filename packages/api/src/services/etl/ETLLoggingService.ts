import type { Env } from '@packrat/api/types/env';
import type { InvalidItemLog, ValidatedCatalogItem } from '@packrat/api/types/etl';

function getDateTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

export class ETLLoggingService {
  private env: Env;
  private timestamp: string = getDateTimeString();
  private logsDestination: string;

  constructor(env: Env, etlSource: string, jobId: string) {
    this.env = env;
    this.logsDestination = `${etlSource}_${this.timestamp}-${jobId}.jsonl`;
  }

  async logInvalidItems(invalidItems: ValidatedCatalogItem[]): Promise<void> {
    if (invalidItems.length === 0) return;

    const logs: InvalidItemLog[] = invalidItems.map((item) => ({
      errors: item.errors,
      rawData: item.item,
      timestamp: Date.now(),
      rowIndex: item.rowIndex,
    }));

    try {
      const message = {
        logsDestination: this.logsDestination,
        logs,
      };
      await this.env.LOGS_QUEUE.send(message);

      console.log(`📝 Logged ${logs.length} invalid items to ${this.logsDestination}`);
    } catch (error) {
      console.error('Failed to log invalid items:', error);
    }
  }
}
