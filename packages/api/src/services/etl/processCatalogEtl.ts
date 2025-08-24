import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { parse } from 'csv-parse';
import { eq } from 'drizzle-orm';
import { R2BucketService } from '../r2-bucket';
import { CatalogItemValidator } from './CatalogItemValidator';
import { queueCatalogETL } from './queue';
import { type CatalogETLMessage, QueueType } from './types';

export const CHUNK_SIZE = 5000;
export const BATCH_SIZE = 10;

async function* streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

export async function processCatalogETL({
  message,
  env,
}: {
  message: CatalogETLMessage;
  env: Env;
}): Promise<void> {
  const { objectKey, source, scraperRevision, startRow = 0 } = message.data;
  const jobId = message.id;

  const db = createDbClient(env);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined; // Declare reader here to ensure it's in scope for finally block

  try {
    console.log(
      `🔄 Processing ETL chunk (rows ${startRow} to ${startRow + CHUNK_SIZE - 1}) for file ${objectKey}, job ${jobId}`,
    );

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
    let validItemsBatch: Partial<NewCatalogItem>[] = [];
    let invalidItemsBatch: NewInvalidItemLog[] = [];
    let totalRows = 0;

    const validator = new CatalogItemValidator();

    console.log(`🔍 [TRACE] Starting streaming process - jobId: ${jobId}, startRow: ${startRow}`);
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

    for await (const row of parser) {
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

      if (rowIndex < startRow) {
        rowIndex++;
        continue;
      }
      if (rowIndex >= startRow + CHUNK_SIZE) {
        break;
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

      if (validItemsBatch.length >= BATCH_SIZE) {
        await env.ETL_QUEUE.send({
          type: QueueType.CATALOG_ETL_WRITE_BATCH,
          id: jobId,
          timestamp: Date.now(),
          data: { items: validItemsBatch, total: totalRows },
        });
        validItemsBatch = [];
        await new Promise((r) => setTimeout(r, 1));
      }

      if (invalidItemsBatch.length >= BATCH_SIZE) {
        await env.LOGS_QUEUE.send({
          data: invalidItemsBatch,
          id: jobId,
          totalItemsCount: totalRows,
        });
        invalidItemsBatch = [];
      }

      rowIndex++;
      totalRows++;

      if (totalRows % 100 === 0) {
        console.log(
          `🔍 [TRACE] Progress update - totalRows: ${totalRows}, rowIndex: ${rowIndex}, validBatch: ${validItemsBatch.length}, invalidBatch: ${invalidItemsBatch.length}`,
        );
      }
    }

    console.log(`🔍 [TRACE] Streaming complete - processing final batches`);

    // Process remaining batches
    if (validItemsBatch.length > 0) {
      console.log(
        `🔍 [TRACE] Processing final valid items batch - size: ${validItemsBatch.length}`,
      );
      await env.ETL_QUEUE.send({
        type: QueueType.CATALOG_ETL_WRITE_BATCH,
        id: jobId,
        timestamp: Date.now(),
        data: { items: validItemsBatch, total: totalRows },
      });
    }

    if (invalidItemsBatch.length > 0) {
      console.log(
        `🔍 [TRACE] Processing final invalid items batch - size: ${invalidItemsBatch.length}`,
      );
      await env.LOGS_QUEUE.send({
        id: jobId,
        data: invalidItemsBatch,
        totalItemsCount: totalRows,
      });
    }

    // Queue next chunk if needed
    if (rowIndex >= startRow + CHUNK_SIZE) {
      console.log(
        `🔍 [TRACE] Queueing next chunk - currentRow: ${rowIndex}, nextStartRow: ${startRow + CHUNK_SIZE}`,
      );
      await queueCatalogETL({
        queue: env.ETL_QUEUE,
        objectKey,
        userId: message.data.userId,
        source,
        scraperRevision,
        jobId,
        startRow: startRow + CHUNK_SIZE,
      });

      console.log(
        `➡️ Queued next ETL chunk for rows ${startRow + CHUNK_SIZE} to ${startRow + 2 * CHUNK_SIZE - 1}`,
      );
    } else {
      console.log(`🔍 [TRACE] No more chunks needed - processed all rows in range`);
    }
  } catch (error) {
    await db
      .update(etlJobs)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(etlJobs.id, jobId));
    console.error(
      `❌ Error processing ETL chunk (rows ${startRow} to ${startRow + CHUNK_SIZE - 1}), job ${jobId}:`,
      error,
    );
    throw error;
  } finally {
    console.log('🔍 [TRACE] Releasing reader lock');
    if (reader) {
      reader.releaseLock();
    }
  }
}
