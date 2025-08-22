import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
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
        fieldMap = row?.reduce(
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

      const item = mapCsvRowToItem({ values: row?.map((v) => v.trim()) ?? [], fieldMap });
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

function mapCsvRowToItem({
  values,
  fieldMap,
}: {
  values: string[];
  fieldMap: Record<string, number>;
}): Partial<NewCatalogItem> | null {
  const item: Partial<NewCatalogItem> = {};
  // --- Optional Scalars ---
  item.description =
    fieldMap.description !== undefined
      ? values[fieldMap.description]?.replace(/[\r\n]+/g, ' ').trim()
      : undefined;

  const name = fieldMap.name !== undefined ? values[fieldMap.name]?.trim() : undefined;
  item.name = name;

  const productUrl =
    fieldMap.productUrl !== undefined ? values[fieldMap.productUrl]?.trim() : undefined;
  item.productUrl = productUrl;

  const currency = fieldMap.currency !== undefined ? values[fieldMap.currency]?.trim() : undefined;
  item.currency = currency;

  const reviewCountStr =
    fieldMap.reviewCount !== undefined ? values[fieldMap.reviewCount] : undefined;
  item.reviewCount = reviewCountStr ? parseInt(reviewCountStr) || 0 : 0;

  if (fieldMap.categories !== undefined && values[fieldMap.categories]) {
    const val = values[fieldMap.categories]?.trim();
    if (val) {
      try {
        item.categories = val.startsWith('[')
          ? JSON.parse(val)
          : val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
      } catch {
        item.categories = [val];
      }
    } else {
      item.categories = undefined;
    }
  } else {
    item.categories = undefined;
  }

  let images: string[] | undefined;
  if (fieldMap.images !== undefined && values[fieldMap.images]) {
    const val = values[fieldMap.images]?.trim();
    if (val) {
      try {
        images = val.startsWith('[')
          ? JSON.parse(val)
          : val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
      } catch {
        images = undefined;
      }
    } else {
      images = undefined;
    }
  } else {
    images = undefined;
  }
  item.images = images;

  // Scalars
  const weightStr = fieldMap.weight !== undefined ? values[fieldMap.weight] : undefined;
  const unitStr = fieldMap.weightUnit !== undefined ? values[fieldMap.weightUnit] : undefined;
  if (weightStr && parseFloat(weightStr) > 0) {
    const { weight, unit } = parseWeight(weightStr, unitStr);
    item.weight = weight || undefined;
    item.weightUnit = unit || undefined;
  }

  const priceStr = fieldMap.price !== undefined ? values[fieldMap.price] : undefined;
  if (priceStr) item.price = parsePrice(priceStr);

  const ratingStr = fieldMap.ratingValue !== undefined ? values[fieldMap.ratingValue] : undefined;
  if (ratingStr) item.ratingValue = parseFloat(ratingStr) || null;

  if (fieldMap.variants !== undefined && values[fieldMap.variants]) {
    const val = values[fieldMap.variants]?.trim();
    if (val) {
      try {
        item.variants = JSON.parse(val);
      } catch {
        try {
          item.variants = JSON.parse(val.replace(/'/g, '"'));
        } catch {
          item.variants = [];
        }
      }
    }
  }

  if (fieldMap.faqs !== undefined && values[fieldMap.faqs]) {
    const val = values[fieldMap.faqs]?.trim();
    if (val) {
      try {
        item.faqs = parseFaqs(val);
      } catch {
        item.faqs = [];
      }
    }
  }

  // JSON fields
  const jsonFields: Extract<'links' | 'reviews' | 'qas', keyof NewCatalogItem>[] = [
    'links',
    'reviews',
    'qas',
  ];
  for (const field of jsonFields) {
    const fieldIndex = fieldMap[String(field)];
    if (fieldIndex !== undefined && values[fieldIndex]) {
      try {
        item[field] = safeJsonParse(values[fieldIndex]);
      } catch {
        item[field] = [];
      }
    }
  }

  // Techs + fallback for weight
  const techsStr = fieldMap.techs !== undefined ? values[fieldMap.techs] : undefined;
  if (techsStr) {
    try {
      const parsed = safeJsonParse<Record<string, string>>(techsStr);
      item.techs = Array.isArray(parsed) ? {} : parsed;

      if (!item.weight && !Array.isArray(parsed)) {
        const claimedWeight = parsed['Claimed Weight'] || parsed.weight;
        if (claimedWeight) {
          const { weight, unit } = parseWeight(claimedWeight);
          item.weight = weight || undefined;
          item.weightUnit = unit || undefined;
        }
      }
    } catch {
      item.techs = {};
    }
  }

  // Direct mappings for string fields
  const stringFields = [
    'brand',
    'model',
    'color',
    'size',
    'sku',
    'productSku',
    'seller',
    'material',
    'condition',
  ] as const;
  for (const field of stringFields) {
    const index = fieldMap[field];
    if (index !== undefined && values[index]) {
      item[field] = values[index].replace(/^"|"$/g, '').trim();
    }
  }

  // Handle availability enum separately
  if (fieldMap.availability !== undefined && values[fieldMap.availability]) {
    const availabilityValue = values[fieldMap.availability];
    if (availabilityValue) {
      item.availability = availabilityValue
        .replace(/^"|"$/g, '')
        .trim() as NewCatalogItem['availability'];
    }
  }

  return item;
}

function parseWeight(
  weightStr: string,
  unitStr?: string,
): { weight: number | null; unit: string | null } {
  if (!weightStr) return { weight: null, unit: null };

  const weightVal = parseFloat(weightStr);
  if (Number.isNaN(weightVal) || weightVal < 0) {
    return { weight: null, unit: null };
  }

  const hint = (unitStr || weightStr).toLowerCase();

  if (hint.includes('oz')) {
    return { weight: Math.round(weightVal * 28.35), unit: 'oz' };
  }
  if (hint.includes('lb')) {
    return { weight: Math.round(weightVal * 453.592), unit: 'lb' };
  }
  if (hint.includes('kg')) {
    return { weight: weightVal * 1000, unit: 'kg' };
  }

  return { weight: weightVal, unit: 'g' };
}

/**
 * Normalizes a messy JSON-like string to make it more parseable by JSON.parse.
 * Handles Python values, smart quotes, invalid escapes, trailing commas, and more.
 */
function normalizeJsonString(value: string): string {
  return (
    value
      .trim()

      // Replace Python-style null/booleans with JS equivalents
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')

      // Normalize smart/special quotes to standard quotes
      .replace(/[‘’‛‹›]/g, "'")
      .replace(/[“”„‟«»]/g, '"')
      .replace(/[`]/g, '')

      // Convert object keys from 'key': to "key":
      .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')

      // Convert string values from 'value' to "escaped value"
      .replace(/:\s*'(.*?)'(?=\s*[},])/g, (_, val) => {
        const escaped = val
          .replace(/\\/g, '\\\\') // Escape backslashes
          .replace(/"/g, '\\"') // Escape double quotes
          .replace(/\\n|\\r|\\b|\\t|\\f|\r?\n|\r|\b|\t|\f/g, '') // Remove newlines/control chars
          .replace(/\u2028|\u2029/g, ''); // Remove special Unicode line separators
        return `: "${escaped}"`;
      })

      // Decode \xNN hex escapes to characters
      .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

      // Escape lone backslashes (e.g., \ not followed by valid escape)
      .replace(/([^\\])\\(?![\\/"'bfnrtu])/g, '$1\\\\')

      // Remove trailing commas before closing braces/brackets
      .replace(/,\s*([}\]])/g, '$1')
  );
}

function safeJsonParse<T = unknown>(value: string): T | [] {
  if (!value || value === 'undefined' || value === 'null') return [];

  const normalized = normalizeJsonString(value);

  try {
    return JSON.parse(normalized) as T;
  } catch (err) {
    console.warn('❌ Failed to parse JSON:', {
      error: err,
      originalInput: value,
      normalizedInput: normalized,
    });
    return [];
  }
}

export function parseFaqs(input: string): Array<{ question: string; answer: string }> {
  if (!input || typeof input !== 'string') return [];

  const results: Array<{ question: string; answer: string }> = [];

  // Remove outer quotes
  let cleaned = input.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).replace(/\\"/g, '"');
  }

  // Replace smart quotes
  cleaned = normalizeJsonString(cleaned);

  // Use a global regex to extract each question-answer block
  const regex =
    /{[^{}]*?['"]question['"]\s*:\s*['"](.+?)['"]\s*,\s*['"]answer['"]\s*:\s*['"](.+?)['"]\s*}/g;

  let match = regex.exec(cleaned);
  while (match !== null) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();
    if (question && answer) {
      results.push({ question, answer });
    }

    match = regex.exec(cleaned);
  }
  return results;
}

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return Number.isNaN(price) ? null : price;
}
