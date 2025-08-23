import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import { mapCsvRowToItem, parseCSVLine } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { eq } from 'drizzle-orm';
import { R2BucketService } from '../r2-bucket';
import { CatalogItemValidator } from './CatalogItemValidator';
import { queueCatalogETL } from './queue';
import { type CatalogETLMessage, QueueType } from './types';

export const CHUNK_SIZE = 5000;
export const BATCH_SIZE = 10;

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

    reader = r2Object.body.getReader();
    console.log(`🔍 [TRACE] Reader created successfully`);

    let buffer = '';
    let rowIndex = 0;
    let fieldMap: Record<string, number> = {};
    let isHeaderProcessed = false;
    let validItemsBatch: Partial<NewCatalogItem>[] = [];
    let invalidItemsBatch: NewInvalidItemLog[] = [];
    let totalRows = 0;

    const validator = new CatalogItemValidator();

    console.log(`🔍 [TRACE] Starting streaming process - jobId: ${jobId}, startRow: ${startRow}`);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(
          `🔍 [TRACE] Stream complete - buffer size: ${buffer.length}, totalRows: ${totalRows}`,
        );
        // Process any remaining data in buffer
        if (buffer.trim()) {
          console.log(
            `🔍 [TRACE] Processing final buffer chunk - lines: ${buffer.split('\n').length}`,
          );
          const processResult = await processBufferChunk({
            buffer,
            rowIndex,
            fieldMap,
            isHeaderProcessed,
            startRow,
            jobId,
            validator,
            validItemsBatch,
            invalidItemsBatch,
            env,
          });
          rowIndex = processResult.newRowIndex;
          totalRows = processResult.newTotalRows;
          validItemsBatch = processResult.validItemsBatch;
          invalidItemsBatch = processResult.invalidItemsBatch;
        }
        break;
      }

      // Decode chunk and add to buffer
      const chunk = new TextDecoder().decode(value, { stream: true });
      const chunkSize = chunk.length;
      buffer += chunk;

      console.log(
        `🔍 [TRACE] Read chunk - size: ${chunkSize}, buffer size: ${buffer.length}, rowIndex: ${rowIndex}`,
      );

      // Process complete lines from buffer
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      const completeLinesCount = lines.length;

      console.log(`🔍 [TRACE] Processing ${completeLinesCount} complete lines`);

      for (const line of lines) {
        if (!line.trim()) {
          console.log(`🔍 [TRACE] Skipping empty line at rowIndex: ${rowIndex}`);
          continue;
        }

        if (!isHeaderProcessed) {
          // Process header row
          const headerRow = parseCSVLine(line);
          fieldMap = headerRow.reduce(
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

        // Only process rows in the current chunk
        if (rowIndex < startRow) {
          console.log(`🔍 [TRACE] Skipping row ${rowIndex} (before startRow ${startRow})`);
          rowIndex++;
          continue;
        }
        if (rowIndex >= startRow + CHUNK_SIZE) {
          console.log(
            `🔍 [TRACE] Reached chunk limit at row ${rowIndex} (startRow: ${startRow}, chunkSize: ${CHUNK_SIZE})`,
          );
          break;
        }

        const row = parseCSVLine(line);
        const item = mapCsvRowToItem({ values: row, fieldMap });

        if (item) {
          const validatedItem = validator.validateItem(item);

          if (validatedItem.isValid) {
            validItemsBatch.push(validatedItem.item);
            console.log(
              `🔍 [TRACE] Valid item added - row: ${rowIndex}, batch size: ${validItemsBatch.length}`,
            );
          } else {
            const invalidItemLog = {
              jobId,
              errors: validatedItem.errors,
              rawData: validatedItem.item,
              rowIndex,
            };
            invalidItemsBatch.push(invalidItemLog);
            console.log(
              `🔍 [TRACE] Invalid item added - row: ${rowIndex}, errors: ${validatedItem.errors.length}, batch size: ${invalidItemsBatch.length}`,
            );
          }
        } else {
          console.log(`🔍 [TRACE] Failed to map CSV row to item - row: ${rowIndex}`);
        }

        if (validItemsBatch.length >= BATCH_SIZE) {
          console.log(
            `🔍 [TRACE] Processing valid items batch - size: ${validItemsBatch.length}, totalRows: ${totalRows}`,
          );
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
          console.log(
            `🔍 [TRACE] Processing invalid items batch - size: ${invalidItemsBatch.length}`,
          );
          await env.LOGS_QUEUE.send({
            data: invalidItemsBatch,
            id: jobId,
            totalItemsCount: totalRows,
          });
          invalidItemsBatch = [];
        }

        rowIndex++;
        totalRows++;

        // Log progress every 100 rows
        if (totalRows % 100 === 0) {
          console.log(
            `🔍 [TRACE] Progress update - totalRows: ${totalRows}, rowIndex: ${rowIndex}, validBatch: ${validItemsBatch.length}, invalidBatch: ${invalidItemsBatch.length}`,
          );
        }
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

async function processBufferChunk({
  buffer,
  rowIndex,
  fieldMap,
  isHeaderProcessed,
  startRow,
  jobId,
  validator,
  validItemsBatch,
  invalidItemsBatch,
  env,
}: {
  buffer: string;
  rowIndex: number;
  fieldMap: Record<string, number>;
  isHeaderProcessed: boolean;
  startRow: number;
  jobId: string;
  validator: CatalogItemValidator;
  validItemsBatch: Partial<NewCatalogItem>[];
  invalidItemsBatch: NewInvalidItemLog[];
  env: Env;
}): Promise<{
  newRowIndex: number;
  newTotalRows: number;
  validItemsBatch: Partial<NewCatalogItem>[];
  invalidItemsBatch: NewInvalidItemLog[];
}> {
  // Process any remaining complete lines in the buffer
  const lines = buffer.split('\n').filter((line) => line.trim());
  let currentRowIndex = rowIndex;
  let totalRows = 0;

  for (const line of lines) {
    if (!isHeaderProcessed) continue;

    if (currentRowIndex < startRow || currentRowIndex >= startRow + CHUNK_SIZE) {
      // Skip if header not processed yet

      currentRowIndex++;
      continue;
    }

    const row = parseCSVLine(line);
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
          rowIndex: currentRowIndex,
        };
        invalidItemsBatch.push(invalidItemLog);
      }
    }
    currentRowIndex++;
    totalRows++;
  }

  return {
    newRowIndex: currentRowIndex,
    newTotalRows: totalRows,
    validItemsBatch,
    invalidItemsBatch,
  };
}
