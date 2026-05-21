import { createDbClient } from '@packrat/api/db';
import { mapCsvRowToItem } from '@packrat/api/utils/csv-utils';
import type { Env } from '@packrat/api/utils/env-validation';
import { isJsonlFile, mapJsonRowToItem } from '@packrat/api/utils/json-utils';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/db';
import { toRecord } from '@packrat/guards';
import { parse } from 'csv-parse';
import { eq } from 'drizzle-orm';
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
  const { objectKey, byteStart, byteEnd } = message.data;
  const jobId = message.id;

  const db = createDbClient(env);

  try {
    const chunkDesc = byteStart !== undefined ? ` [bytes ${byteStart}-${byteEnd ?? 'end'}]` : '';
    console.log(`🔄 Processing file ${objectKey}${chunkDesc}, job ${jobId}`);

    const r2Service = new R2BucketService({
      env,
      bucketType: 'catalog',
    });

    // For non-first chunks (byteStart > 0): fetch the header row separately via a
    // cheap 4 KB range request so the CSV parser sees a valid header.
    let injectedHeader = '';
    if (byteStart !== undefined && byteStart > 0) {
      const headerSlice = await r2Service.get(objectKey, { range: { offset: 0, length: 4096 } });
      if (!headerSlice) throw new Error(`Failed to fetch header for ${objectKey}`);
      const headerText = await headerSlice.text();
      injectedHeader = headerText.split('\n')[0] ?? '';
    }

    const rangeOptions =
      byteStart !== undefined
        ? {
            range: {
              offset: byteStart,
              length: byteEnd !== undefined ? byteEnd - byteStart + 1 : undefined,
            },
          }
        : undefined;

    console.log(`🔍 [TRACE] Getting stream for object: ${objectKey}${chunkDesc}`);
    const r2Object = await r2Service.get(objectKey, rangeOptions);
    if (!r2Object) {
      throw new Error(`Failed to get stream for object: ${objectKey}`);
    }

    let rowIndex = 0;
    const validItemsBatch: Partial<NewCatalogItem>[] = [];
    const invalidItemsBatch: NewInvalidItemLog[] = [];

    const validator = new CatalogItemValidator();
    const useJsonl = isJsonlFile(objectKey);

    if (useJsonl) {
      // --- JSONL streaming path ---
      // No csv-parse, no header injection. Each line is a JSON object.
      let buffer = '';
      // The chunker snaps boundaries to newlines, so every chunk starts at a
      // clean line boundary — no partial first-line skip needed for any chunk.
      let firstLineSkipped = true;

      for await (const chunk of streamToText(r2Object.body)) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (!firstLineSkipped) {
            firstLineSkipped = true;
            continue; // discard partial row at chunk boundary
          }

          // Yield every 100 rows for GC; per-row yield hits the CF Worker wall-clock limit
          if (rowIndex % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 1));

          let obj: Record<string, unknown>;
          try {
            obj = toRecord(JSON.parse(trimmed));
          } catch (parseErr) {
            invalidItemsBatch.push({
              jobId,
              errors: [{ field: 'json_parse', reason: String(parseErr) }],
              rawData: { parseError: String(parseErr) },
              rowIndex,
            });
            rowIndex++;
            if (invalidItemsBatch.length >= BATCH_SIZE) {
              await processLogsBatch({ jobId, logs: [...invalidItemsBatch], env });
              invalidItemsBatch.length = 0;
            }
            continue;
          }

          const item = mapJsonRowToItem(obj);
          if (item) {
            const validated = validator.validateItem(item);
            if (validated.isValid) {
              validItemsBatch.push(validated.item);
            } else {
              invalidItemsBatch.push({
                jobId,
                errors: validated.errors,
                rawData: validated.item,
                rowIndex,
              });
            }
          }
          rowIndex++;

          if (validItemsBatch.length >= BATCH_SIZE) {
            await processValidItemsBatch({ jobId, items: [...validItemsBatch], env });
            validItemsBatch.length = 0;
          }
          if (invalidItemsBatch.length >= BATCH_SIZE) {
            await processLogsBatch({ jobId, logs: [...invalidItemsBatch], env });
            invalidItemsBatch.length = 0;
          }
        }
      }

      // Flush remaining buffer line (last line without trailing newline)
      const lastLine = buffer.trim();
      if (lastLine && firstLineSkipped) {
        try {
          const obj = toRecord(JSON.parse(lastLine));
          const item = mapJsonRowToItem(obj);
          if (item) {
            const validated = validator.validateItem(item);
            if (validated.isValid) {
              validItemsBatch.push(validated.item);
            } else {
              invalidItemsBatch.push({
                jobId,
                errors: validated.errors,
                rawData: validated.item,
                rowIndex,
              });
            }
          }
          rowIndex++;
        } catch (parseErr) {
          invalidItemsBatch.push({
            jobId,
            errors: [{ field: 'json_parse', reason: String(parseErr) }],
            rawData: { parseError: String(parseErr) },
            rowIndex,
          });
          rowIndex++;
        }
      }
    } else {
      // --- CSV path (unchanged) ---
      let fieldMap: Record<string, number> = {};
      let isHeaderProcessed = false;

      const parser = parse({
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true,
        skip_records_with_error: true,
        on_skip: (err) => {
          const parserLine = (err as { lines?: number } | undefined)?.lines ?? rowIndex;
          const message = err?.message ?? 'unknown parse error';
          const parseErrorLog: NewInvalidItemLog = {
            jobId,
            errors: [{ field: 'csv_parse', reason: message }],
            rawData: { parseError: message },
            rowIndex: parserLine,
          };
          invalidItemsBatch.push(parseErrorLog);
          console.warn(`[ETL] Skipped malformed CSV row at parser line ${parserLine}: ${message}`);
        },
      });

      (async () => {
        // Non-first chunks: inject the header row so csv-parse sees a valid header,
        // then skip the partial row at the chunk boundary (tail of the previous chunk).
        if (injectedHeader) {
          parser.write(`${injectedHeader}\n`);
        }
        let skipPartialRow = byteStart !== undefined && byteStart > 0;

        for await (const chunk of streamToText(r2Object.body)) {
          let text = chunk;

          if (skipPartialRow) {
            // Discard bytes up to and including the first newline — those bytes are
            // the tail of the row that the previous chunk already processed.
            const nl = text.indexOf('\n');
            if (nl === -1) continue; // entire buffer is still the partial row tail
            text = text.slice(nl + 1);
            skipPartialRow = false;
            if (!text) continue;
          }

          // Respect backpressure: if the parser buffer is full, wait for drain before
          // pushing more data. Without this, R2 fills the parser buffer for the entire
          // file (up to 600 MB) before the main loop processes any rows → Worker OOM.
          const ok = parser.write(text);
          if (!ok) await new Promise<void>((resolve) => parser.once('drain', resolve));
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

        // Flush valid batch to DB every BATCH_SIZE rows to avoid Worker OOM on large files.
        // totalProcessed is incremented atomically inside processValidItemsBatch via updateEtlJobProgress.
        if (validItemsBatch.length >= BATCH_SIZE) {
          await processValidItemsBatch({ jobId, items: [...validItemsBatch], env });
          validItemsBatch.length = 0;
        }
        // Flush invalid batch to DB every BATCH_SIZE rows.
        // totalProcessed is incremented atomically inside processLogsBatch via updateEtlJobProgress.
        if (invalidItemsBatch.length >= BATCH_SIZE) {
          await processLogsBatch({ jobId, logs: [...invalidItemsBatch], env });
          invalidItemsBatch.length = 0;
        }
      }
    }

    console.log(`🔍 [TRACE] Streaming complete - processing remaining batches`);

    // Flush remaining items. totalProcessed is updated atomically inside each batch function.
    if (validItemsBatch.length > 0) {
      console.log(`🔍 [TRACE] Processing valid items batch - size: ${validItemsBatch.length}`);
      await processValidItemsBatch({ jobId, items: validItemsBatch, env });
    }

    if (invalidItemsBatch.length > 0) {
      console.log(`🔍 [TRACE] Processing invalid items batch - size: ${invalidItemsBatch.length}`);
      await processLogsBatch({ jobId, logs: invalidItemsBatch, env });
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
