import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { parse } from 'csv-parse';
import { eq, sql } from 'drizzle-orm';
import { R2BucketService } from '../r2-bucket';
import { CatalogItemValidator } from './CatalogItemValidator';
import { processLogsBatch } from './processLogsBatch';
import { processValidItemsBatch } from './processValidItemsBatch';
import type { CatalogETLMessage } from './types';

export const BATCH_SIZE = 100;

async function* streamToText(stream: ReadableStream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function processCatalogETL({
  message,
  env,
}: {
  message: CatalogETLMessage;
  env: Env;
}): Promise<void> {
  const { objectKey } = message.data;
  const jobId = message.id;

  const db = createDbClient(env);

  try {
    console.log(`🔄 Processing file ${objectKey}, job ${jobId}`);

    const r2Service = new R2BucketService({
      env,
      bucketType: 'catalog',
    });

    console.log(`🔍 [TRACE] Getting stream for object: ${objectKey}`);
    const r2Object = await r2Service.get(objectKey);
    if (!r2Object) {
      throw new Error(`Failed to get stream for object: ${objectKey}`);
    }

    let rowIndex = 0;
    let fieldMap: Record<string, number> = {};
    let isHeaderProcessed = false;
    const validItemsBatch: Partial<NewCatalogItem>[] = [];
    const invalidItemsBatch: NewInvalidItemLog[] = [];

    const validator = new CatalogItemValidator();

    const parser = parse({
      relax_column_count: true,
      skip_empty_lines: true,
    });

    (async () => {
      for await (const chunk of streamToText(r2Object.body)) {
        parser.write(chunk);
      }
      parser.end();
    })();

    for await (const record of parser) {
      await new Promise((resolve) => setTimeout(resolve, 1)); // Yield to event loop for GC Opportunities to prevent memory bloat
      const row = record as string[];
      if (!isHeaderProcessed) {
        fieldMap = row.reduce(
          (acc, header, idx) => {
            acc[header.trim()] = idx;
            return acc;
          },
          {} as Record<string, number>,
        );
        isHeaderProcessed = true;
        console.log(
          `🔍 [TRACE] Header processed - fields: ${Object.keys(fieldMap).length}, mapping:`,
          Object.keys(fieldMap),
        );
        continue;
      }

      const item = mapCsvRowToItem({ values: row, fieldMap });

      if (item) {
        const validatedItem = validator.validateItem(item);

        if (validatedItem.isValid) {
          validItemsBatch.push(validatedItem.item);
        } else {
          const invalidItemLog = {
            jobId,
            errors: validatedItem.errors,
            rawData: validatedItem.item,
            rowIndex,
          };
          invalidItemsBatch.push(invalidItemLog);
        }
      }

      rowIndex++;
    }

    console.log(`🔍 [TRACE] Streaming complete - processing batches`);

    const itemsProcessed = validItemsBatch.length + invalidItemsBatch.length;

    await db
      .update(etlJobs)
      .set({ totalProcessed: sql`COALESCE(${etlJobs.totalProcessed}, 0) + ${itemsProcessed}` })
      .where(eq(etlJobs.id, jobId));

    if (validItemsBatch.length > 0) {
      console.log(`🔍 [TRACE] Processing valid items batch - size: ${validItemsBatch.length}`);
      await processValidItemsBatch({
        jobId,
        items: validItemsBatch,
        env,
      });
    }

    if (invalidItemsBatch.length > 0) {
      console.log(`🔍 [TRACE] Processing invalid items batch - size: ${invalidItemsBatch.length}`);
      await processLogsBatch({
        jobId,
        logs: invalidItemsBatch,
        env,
      });
    }

    const totalRows = rowIndex;

    console.log(`🔍 [TRACE] ✅ Done processing ${objectKey} - ${totalRows} rows processed`);
  } catch (error) {
    await db
      .update(etlJobs)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(etlJobs.id, jobId));
    console.error(`❌ Error processing ${message.data.objectKey}, job ${jobId}:`, error);
    throw error;
  }
}
