import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import { createDbClient } from '@packrat/api/db';
import { etlJobs, type NewCatalogItem, type NewInvalidItemLog } from '@packrat/api/db/schema';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import type { Env } from '@packrat/api/utils/env-validation';
import { parse } from 'csv-parse/sync';
import { eq } from 'drizzle-orm';
import { CatalogService } from '../catalogService';
import { generateManyEmbeddings } from '../embeddingService';
import { R2BucketService } from '../r2-bucket';
import { CatalogItemValidator } from './CatalogItemValidator';
import { mergeItemsBySku } from './mergeItemsBySku';

export enum QueueType {
  CATALOG_ETL = 'catalog-etl',
  CATALOG_ETL_WRITE_BATCH = 'catalog-etl-write-batch',
}

export interface BaseQueueMessage {
  type: QueueType;
  timestamp: number;
  id: string;
}

export interface CatalogETLMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL;
  data: {
    objectKey: string;
    userId: string;
    filename: string;
    scraperRevision: string;
  };
}

export interface CatalogETLWriteBatchMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL_WRITE_BATCH;
  data: {
    items: Partial<NewCatalogItem>[];
  };
}

const BATCH_SIZE = 10;

export async function queueCatalogETL({
  queue,
  objectKey,
  userId,
  filename,
  scraperRevision,
}: {
  queue: Queue;
  objectKey: string;
  userId: string;
  filename: string;
  scraperRevision: string;
}): Promise<string> {
  const jobId = crypto.randomUUID();

  const message: CatalogETLMessage = {
    type: QueueType.CATALOG_ETL,
    data: { objectKey, userId, filename, scraperRevision },
    timestamp: Date.now(),
    id: jobId,
  };

  await queue.send(message);
  return jobId;
}

export async function processQueueBatch({
  batch,
  env,
}: {
  batch: MessageBatch<BaseQueueMessage>;
  env: Env;
}): Promise<void> {
  for (const message of batch.messages) {
    try {
      const queueMessage: BaseQueueMessage = message.body;

      switch (queueMessage.type) {
        case QueueType.CATALOG_ETL:
          await processCatalogETL({
            message: queueMessage as CatalogETLMessage,
            env,
          });
          break;

        case QueueType.CATALOG_ETL_WRITE_BATCH:
          await processCatalogETLWriteBatch({
            message: queueMessage as CatalogETLWriteBatchMessage,
            env,
          });
          break;

        default:
          console.warn(`Unknown queue message type: ${queueMessage.type}`);
      }
    } catch (error) {
      console.error('Error processing queue message:', error);
    }
  }
}

async function processCatalogETL({
  message,
  env,
}: {
  message: CatalogETLMessage;
  env: Env;
}): Promise<void> {
  const { objectKey, filename, scraperRevision } = message.data;
  const jobId = message.id;

  const db = createDbClient(env);
  try {
    await db.insert(etlJobs).values({
      id: jobId,
      status: 'running',
      source: filename,
      objectKey,
      scraperRevision,
      startedAt: new Date(),
    });

    console.log(`🚀 Starting ETL job ${jobId} for file ${filename}`);

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
    let totalProcessed = 0;
    let totalValid = 0;
    let totalInvalid = 0;

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
        console.log(`📋 Processing ${filename} with field mapping:`, Object.keys(fieldMap));
        continue;
      }

      const item = mapCsvRowToItem({ values: row, fieldMap });
      if (item) {
        const validatedItem = validator.validateItem(item);
        totalProcessed++;

        if (validatedItem.isValid) {
          validItemsBatch.push(validatedItem.item);
          totalValid++;
        } else {
          const invalidItemLog = {
            jobId,
            errors: validatedItem.errors,
            rawData: validatedItem.item,
            rowIndex,
          };
          invalidItemsBatch.push(invalidItemLog);
          totalInvalid++;
        }
      }

      if (validItemsBatch.length >= BATCH_SIZE) {
        await env.ETL_QUEUE.send({
          type: QueueType.CATALOG_ETL_WRITE_BATCH,
          id: jobId,
          timestamp: Date.now(),
          data: { items: validItemsBatch },
        });
        validItemsBatch = [];
        await new Promise((r) => setTimeout(r, 1));
      }

      if (invalidItemsBatch.length >= BATCH_SIZE) {
        await env.LOGS_QUEUE.send(invalidItemsBatch);
        invalidItemsBatch = [];
      }
    }

    if (validItemsBatch.length > 0) {
      await env.ETL_QUEUE.send({
        type: QueueType.CATALOG_ETL_WRITE_BATCH,
        id: jobId,
        timestamp: Date.now(),
        data: { items: validItemsBatch },
      });
    }

    if (invalidItemsBatch.length > 0) {
      await env.LOGS_QUEUE.send(invalidItemsBatch);
    }

    await db
      .update(etlJobs)
      .set({
        status: 'completed',
        totalProcessed,
        totalValid,
        totalInvalid,
        completedAt: new Date(),
      })
      .where(eq(etlJobs.id, jobId));

    console.log(
      `✅ ETL job ${jobId} completed: Processed ${totalProcessed} items (${totalValid} valid, ${totalInvalid} invalid)`,
    );
  } catch (error) {
    await db
      .update(etlJobs)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(etlJobs.id, jobId));
    console.error(`❌ ETL job ${jobId} failed:`, error);
    throw error;
  }
}

async function processCatalogETLWriteBatch({
  message,
  env,
}: {
  message: CatalogETLWriteBatchMessage;
  env: Env;
}): Promise<void> {
  const jobId = message.id;
  const { items } = message.data;

  const catalogService = new CatalogService(env, false);

  // Consolidate items with identical SKUs before upserting to avoid conflicting duplicate upserts.
  const mergedItems = mergeItemsBySku(items as NewCatalogItem[]);

  // Prepare texts for batch embedding
  const embeddingTexts = mergedItems.map((item) => getEmbeddingText(item));

  try {
    // Generate embeddings in batch
    const embeddings = await generateManyEmbeddings({
      openAiApiKey: env.OPENAI_API_KEY,
      values: embeddingTexts,
    });

    // Combine items with their embeddings
    const itemsWithEmbeddings = mergedItems.map((item, index) => ({
      ...item,
      embedding: embeddings[index],
    }));

    const upsertedItems = await catalogService.upsertCatalogItems(itemsWithEmbeddings);
    // Track the ETL job that processed these items
    await catalogService.trackEtlJob(upsertedItems, jobId);
  } catch (error) {
    console.error(`Error generating embeddings for batch ${jobId}:`, error);
    // Fall back to processing without embeddings
    const upsertedItems = await catalogService.upsertCatalogItems(mergedItems);
    await catalogService.trackEtlJob(upsertedItems, jobId);
  } finally {
    console.log(`📦 Batch ${jobId}: Processed ${items.length} valid items`);
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
    const val = values[fieldMap.categories].trim();
    try {
      item.categories = val.startsWith('[')
        ? JSON.parse(val)
        : val
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
    } catch {
      item.categories = val ? [val] : undefined;
    }
  } else {
    item.categories = undefined;
  }

  let images: string[] | undefined;
  if (fieldMap.images !== undefined && values[fieldMap.images]) {
    try {
      const val = values[fieldMap.images].trim();
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
    const val = values[fieldMap.variants].trim();
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

  if (fieldMap.faqs !== undefined && values[fieldMap.faqs]) {
    const val = values[fieldMap.faqs].trim();
    try {
      item.faqs = parseFaqs(val);
    } catch {
      item.faqs = [];
    }
  }

  // JSON fields
  const jsonFields: Extract<'links' | 'reviews' | 'qas', keyof NewCatalogItem>[] = [
    'links',
    'reviews',
    'qas',
  ];
  for (const field of jsonFields) {
    if (fieldMap[field as string] !== undefined && values[fieldMap[field as string]]) {
      try {
        item[field] = safeJsonParse(values[fieldMap[field as string]]);
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
    item.availability = values[fieldMap.availability]
      .replace(/^"|"$/g, '')
      .trim() as NewCatalogItem['availability'];
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
    const question = match[1].trim();
    const answer = match[2].trim();
    results.push({ question, answer });

    match = regex.exec(cleaned);
  }
  return results;
}

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return Number.isNaN(price) ? null : price;
}
