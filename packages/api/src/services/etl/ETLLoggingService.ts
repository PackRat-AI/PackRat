import type { Env } from '@packrat/api/types/env';
import type { InvalidItemLog, ValidatedCatalogItem } from '@packrat/api/types/etl';
import { R2BucketService } from '../r2-bucket';

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
  private r2Service: R2BucketService;

  constructor(env: Env) {
    this.env = env;
    this.r2Service = new R2BucketService({
      env,
      bucketType: 'catalog',
    });
  }

  async logInvalidItems(
    invalidItems: ValidatedCatalogItem[],
    filepath: string,
    importId: string,
  ): Promise<void> {
    if (invalidItems.length === 0) return;

    const logs: InvalidItemLog[] = invalidItems.map((item) => ({
      importId,
      errors: item.errors,
      rawData: item.item,
      timestamp: Date.now(),
      rowIndex: item.rowIndex,
    }));

    const logKey = `${filepath}_${this.timestamp}.jsonl`;

    try {
      await this.r2Service.put(
        logKey,
        JSON.stringify(
          {
            importId,
            totalInvalidItems: logs.length,
            timestamp: Date.now(),
            logs,
          },
          null,
          2,
        ),
        {
          httpMetadata: {
            contentType: 'application/json',
          },
        },
      );

      console.log(`📝 Logged ${logs.length} invalid items to ${logKey}`);
    } catch (error) {
      console.error('Failed to log invalid items:', error);
    }

    // Also log summary to console for immediate visibility
    console.warn(`❌ Validation failed for ${logs.length} items:`);
    logs.forEach((log) => {
      console.warn(`  - ${log.rowIndex}: ${log.errors.map((e) => e.reason).join(', ')}`);
    });
  }
}
