import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
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
      if (rowIndex % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 1)); // Yield every 100 rows for GC; per-row yield hits the CF Worker wall-clock limit on large files
      const row = record as string[];
      if (!isHeaderProcessed) {
        fieldMap = row.reduce<Record<string, number>>((acc, header, idx) => {
          acc[header.trim()] = idx;
          return acc;
        }, {});
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

      // Flush valid batch to DB every BATCH_SIZE rows to avoid Worker OOM on large files
      if (validItemsBatch.length >= BATCH_SIZE) {
        await processValidItemsBatch({ jobId, items: [...validItemsBatch], env });
        await db
          .update(etlJobs)
          .set({ totalProcessed: sql`COALESCE(${etlJobs.totalProcessed}, 0) + ${BATCH_SIZE}` })
          .where(eq(etlJobs.id, jobId));
        validItemsBatch.length = 0;
      }
      // Flush invalid batch to DB every BATCH_SIZE rows
      if (invalidItemsBatch.length >= BATCH_SIZE) {
        await processLogsBatch({ jobId, logs: [...invalidItemsBatch], env });
        await db
          .update(etlJobs)
          .set({ totalProcessed: sql`COALESCE(${etlJobs.totalProcessed}, 0) + ${BATCH_SIZE}` })
          .where(eq(etlJobs.id, jobId));
        invalidItemsBatch.length = 0;
      }
    }

    console.log(`🔍 [TRACE] Streaming complete - processing remaining batches`);

    // Flush remaining items BEFORE updating totalProcessed so that if a flush throws,
    // totalProcessed isn't inflated while valid/invalid counts stay null.
    const remainingValid = validItemsBatch.length;
    const remainingInvalid = invalidItemsBatch.length;

    if (remainingValid > 0) {
      console.log(`🔍 [TRACE] Processing valid items batch - size: ${remainingValid}`);
      await processValidItemsBatch({ jobId, items: validItemsBatch, env });
    }

    if (remainingInvalid > 0) {
      console.log(`🔍 [TRACE] Processing invalid items batch - size: ${remainingInvalid}`);
      await processLogsBatch({ jobId, logs: invalidItemsBatch, env });
    }

    const remainingItems = remainingValid + remainingInvalid;
    if (remainingItems > 0) {
      await db
        .update(etlJobs)
        .set({ totalProcessed: sql`COALESCE(${etlJobs.totalProcessed}, 0) + ${remainingItems}` })
        .where(eq(etlJobs.id, jobId));
    }

    const totalRows = rowIndex;

    // Mark completed using Drizzle ORM (same as the failed path below) — avoids the
    // silent failure that ::etl_job_status raw SQL casts produced in some Neon HTTP driver versions.
    // Isolated try-catch so a transient DB hiccup here doesn't cascade to status='failed'.
    try {
      await db
        .update(etlJobs)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(etlJobs.id, jobId));
    } catch (completionErr) {
      console.error(
        `[ETL] Failed to mark job ${jobId} completed — will be reset by stuck-job sweep:`,
        completionErr,
      );
    }

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
