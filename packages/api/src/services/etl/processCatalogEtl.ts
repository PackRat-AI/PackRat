import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { parse } from 'csv-parse';
import { eq } from 'drizzle-orm';
import { R2BucketService } from '../r2-bucket';
import { CatalogItemValidator } from './CatalogItemValidator';
import { processLogsBatch } from './processLogsBatch';
import { processValidItemsBatch } from './processValidItemsBatch';
import { queueCatalogETL } from './queue';
import type { CatalogETLMessage } from './types';

export const CHUNK_SIZE = 10000;
export const BATCH_SIZE = 500;

async function* streamToText(stream: ReadableStream) {
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
    let rowsProcessedInChunk = 0;

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

    for await (const record of parser) {
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
        await processValidItemsBatch({
          jobId,
          items: validItemsBatch,
          env,
        });
        validItemsBatch = [];
        await new Promise((r) => setTimeout(r, 1));
      }

      if (invalidItemsBatch.length >= BATCH_SIZE) {
        await processLogsBatch({
          jobId,
          logs: invalidItemsBatch,
          env,
        });
        invalidItemsBatch = [];
      }

      rowIndex++;
      rowsProcessedInChunk++;

      if (rowsProcessedInChunk % 100 === 0) {
        console.log(
          `🔍 [TRACE] Progress update - rowsProcessedInChunk: ${rowsProcessedInChunk}, rowIndex: ${rowIndex}, validBatch: ${validItemsBatch.length}, invalidBatch: ${invalidItemsBatch.length}`,
        );
      }
    }

    console.log(`🔍 [TRACE] Streaming complete - processing final batches`);

    // Flush remaining batches
    if (validItemsBatch.length > 0) {
      console.log(
        `🔍 [TRACE] Processing final valid items batch - size: ${validItemsBatch.length}`,
      );
      await processValidItemsBatch({
        jobId,
        items: validItemsBatch,
        env,
      });
    }

    if (invalidItemsBatch.length > 0) {
      console.log(
        `🔍 [TRACE] Processing final invalid items batch - size: ${invalidItemsBatch.length}`,
      );
      await processLogsBatch({
        jobId,
        logs: invalidItemsBatch,
        env,
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
      console.log('🔍 [TRACE] No more chunks needed - processed all rows');
      await db
        .update(etlJobs)
        .set({ totalCount: rowIndex, status: 'completed', completedAt: new Date() })
        .where(eq(etlJobs.id, jobId));
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
  }
}
