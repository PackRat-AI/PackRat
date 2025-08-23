import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { parse } from 'csv-parse/sync';
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
  try {
    console.log(
      `🚀 Starting ETL job ${jobId} for file ${objectKey} (rows ${startRow} to ${startRow + CHUNK_SIZE - 1})`,
    );

    const r2Service = new R2BucketService({
      env,
      bucketType: 'catalog',
    });

    const object = await r2Service.get(objectKey);
    if (!object) {
      throw new Error(`Object not found: ${objectKey}`);
    }

    const text = await object.text();
    const rows: string[][] = parse(text, {
      relax_column_count: true,
      skip_empty_lines: true,
    });

    let isHeader = true;
    let fieldMap: Record<string, number> = {};
    let validItemsBatch: Partial<NewCatalogItem>[] = [];
    let invalidItemsBatch: NewInvalidItemLog[] = [];

    const validator = new CatalogItemValidator();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];

      if (isHeader) {
        fieldMap = row.reduce(
          (acc, header, idx) => {
            acc[header.trim()] = idx;
            return acc;
          },
          {} as Record<string, number>,
        );
        isHeader = false;
        console.log(`📋 Processing ${objectKey} with field mapping:`, Object.keys(fieldMap));
        continue;
      }

      // Only process rows in the current chunk
      const dataRowIndex = rowIndex - 1; // -1 because header is row 0
      if (dataRowIndex < startRow) continue;
      if (dataRowIndex >= startRow + CHUNK_SIZE) break;

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
          data: { items: validItemsBatch, total: rows.length - 1 }, // -1 for header
        });
        validItemsBatch = [];
        await new Promise((r) => setTimeout(r, 1));
      }

      if (invalidItemsBatch.length >= BATCH_SIZE) {
        await env.LOGS_QUEUE.send({
          data: invalidItemsBatch,
          id: jobId,
          totalItemsCount: rows.length - 1,
        });
        invalidItemsBatch = [];
      }
    }

    if (validItemsBatch.length > 0) {
      await env.ETL_QUEUE.send({
        type: QueueType.CATALOG_ETL_WRITE_BATCH,
        id: jobId,
        timestamp: Date.now(),
        data: { items: validItemsBatch, total: rows.length - 1 },
      });
    }

    if (invalidItemsBatch.length > 0) {
      await env.LOGS_QUEUE.send({
        id: jobId,
        data: invalidItemsBatch,
        totalItemsCount: rows.length - 1,
      });
    }

    if (rows.length - 1 > startRow + CHUNK_SIZE) {
      // If more rows remain, enqueue next chunk
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
    }
  } catch (error) {
    await db
      .update(etlJobs)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(etlJobs.id, jobId));
    console.error(`❌ ETL job ${jobId} failed:`, error);
    throw error;
  }
}
