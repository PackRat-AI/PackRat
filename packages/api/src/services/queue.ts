import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import { catalogItems, type NewCatalogItem } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { parse } from 'csv-parse/sync';
import { eq, getTableColumns, isNull, or, type SQL, sql } from 'drizzle-orm';
import { createDbClient } from '../db';
import { R2BucketService } from './r2-service';

export enum QueueType {
  CATALOG_ETL = 'catalog-etl',
  CATALOG_ETL_WRITE_BATCH = 'catalog-etl-write-batch',
}

export interface BaseQueueMessage {
  type: QueueType;
  timestamp: number;
  id: string; // Original Job ID
}

export interface CatalogETLMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL;
  data: {
    objectKey: string;
    userId: string;
    filename: string;
  };
}

export interface CatalogETLWriteBatchMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL_WRITE_BATCH;
  data: {
    items: Partial<NewCatalogItem>[];
    userId: string;
  };
}

const BATCH_SIZE = 10; // Process 10 rows at a time to stay under 128KB message limit
const _CHUNK_SIZE = 5 * 1024 * 1024; // Read 5MB chunks from R2

export async function sendToQueue({
  queue,
  message,
}: {
  queue: Queue;
  message: BaseQueueMessage;
}): Promise<void> {
  await queue.send(message);
}

export async function queueCatalogETL({
  queue,
  objectKey,
  userId,
  filename,
}: {
  queue: Queue;
  objectKey: string;
  userId: string;
  filename: string;
}): Promise<string> {
  const jobId = crypto.randomUUID();

  const message: CatalogETLMessage = {
    type: QueueType.CATALOG_ETL,
    data: { objectKey, userId, filename },
    timestamp: Date.now(),
    id: jobId,
  };

  await sendToQueue({ queue, message });
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
          if (!env.ETL_QUEUE) throw new Error('ETL_QUEUE is not configured');
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
  const { objectKey, userId, filename } = message.data;
  const jobId = message.id;

  console.log(`Starting ETL job ${jobId} for file ${filename}`);

  // Use R2BucketService instead of direct binding
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
  let batch: Partial<NewCatalogItem>[] = [];
  let totalQueued = 0;

  for (const row of rows) {
    if (isHeader) {
      fieldMap = createFieldMap(row.map((h) => h.trim().toLowerCase()));
      isHeader = false;
      console.log(`Processing ${filename} with field mapping:`, fieldMap);
      continue;
    }
    const item = mapCsvRowToItem({ values: row, fieldMap });
    if (item) batch.push(item);

    if (batch.length >= BATCH_SIZE) {
      await env.ETL_QUEUE.send({
        type: QueueType.CATALOG_ETL_WRITE_BATCH,
        id: jobId,
        timestamp: Date.now(),
        data: { items: batch, userId },
      });
      totalQueued += batch.length;
      batch = [];
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  if (batch.length > 0) {
    await env.ETL_QUEUE.send({
      type: QueueType.CATALOG_ETL_WRITE_BATCH,
      id: jobId,
      timestamp: Date.now(),
      data: { items: batch, userId },
    });
    totalQueued += batch.length;
  }

  console.log(`ETL job ${jobId} completed: Queued ${totalQueued} total items for writing.`);
}

export async function processCatalogETLWriteBatch({
  message,
  env,
}: {
  message: CatalogETLWriteBatchMessage;
  env: Env;
}) {
  const { items, userId } = message.data;
  const jobId = message.id;
  await insertCatalogItems({ env, items, userId, jobId });
}

function createFieldMap(headers: string[]): Record<string, number> {
  const fieldMap: Record<string, number> = {};
  console.log('CSV Headers:', headers);

  const mappings = {
    name: [
      'name',
      'item_name',
      'product_name',
      'title',
      'product',
      'item',
      'Name',
      'PRODUCT_NAME',
      'Title',
    ],
    description: [
      'description',
      'desc',
      'summary',
      'info',
      'product_description',
      'Description',
      'DESCRIPTION',
    ],
    weight: ['weight', 'weight_grams', 'weight_oz', 'wt', 'mass'],
    weightUnit: ['weightUnit', 'weightunit', 'weight_unit', 'unit', 'mass_unit'],
    categories: [
      'categories',
      'category',
      'type',
      'category_name',
      'cat',
      'product_category',
      'product_type',
      'Category',
      'CATEGORY',
    ],
    brand: [
      'brand',
      'manufacturer',
      'company',
      'make',
      'brand_name',
      'Brand',
      'BRAND_NAME',
      'Manufacturer',
    ],
    model: ['model', 'model_number', 'part_number'],
    sku: ['sku', 'item_number', 'product_id', 'id', 'item_id'],
    productSku: ['productSku', 'productsku', 'product_sku'],
    price: ['price', 'cost', 'amount', 'price_usd', 'msrp', 'Price', 'PRICE', 'Cost'],
    images: [
      'images',
      'image',
      'image_url',
      'photo',
      'picture',
      'img',
      'image_urls',
      'photo_url',
      'Image',
      'IMAGE_URL',
    ],
    url: ['url', 'link', 'website', 'web', 'href', 'URL'],
    productUrl: ['productUrl', 'producturl', 'product_url', 'PRODUCT_URL'],
    color: ['color', 'colour'],
    size: ['size'],
    material: ['material', 'fabric'],
    condition: ['condition'],
    seller: ['seller', 'vendor', 'retailer'],
    availability: [
      'availability',
      'stock',
      'inventory_status',
      'in_stock',
      'quantity',
      'Availability',
      'AVAILABILITY',
    ],
    currency: ['currency', 'price_currency'],
    ratingValue: [
      'ratingValue',
      'ratingvalue',
      'rating',
      'rating_value',
      'stars',
      'average_rating',
    ],
    reviewCount: ['reviewCount', 'reviewcount', 'review_count', 'reviews_count', 'num_reviews'],
    techs: ['techs'],
    variants: ['variants'],
    links: ['links'],
    reviews: ['reviews'],
    qas: ['qas', 'questions'],
    faqs: ['faqs', 'frequently_asked_questions'],
    details: ['details'],
    parameters: ['parameters'],
    site: ['site'],
    filename: ['filename'],
    sourceFile: ['source_file'],
    timestamp: ['cached_at', 'exported_at', 'created_at'],
  };

  for (const [dbField, csvVariants] of Object.entries(mappings)) {
    for (const variant of csvVariants) {
      const index = headers.findIndex((h) => h.toLowerCase() === variant);
      if (index !== -1) {
        fieldMap[dbField] = index;
        break;
      }
    }
  }

  return fieldMap;
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
      item.categories = [val || 'Uncategorized'];
    }
  } else {
    item.categories = ['Uncategorized'];
  }

  let images: string[] = [];
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
      images = [];
    }
  } else {
    images = [];
  }
  item.images = images;

  // Required fields
  if (!name || !productUrl || !currency || images.length === 0)
    throw new Error('Missing required fields: name, productUrl, currency, or images');

  // Scalars
  const weightStr = fieldMap.weight !== undefined ? values[fieldMap.weight] : undefined;
  const unitStr = fieldMap.weightUnit !== undefined ? values[fieldMap.weightUnit] : undefined;
  if (weightStr && parseFloat(weightStr) > 0) {
    const { weight, unit } = parseWeight(weightStr, unitStr);
    item.weight = weight;
    item.weightUnit = unit;
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
  const jsonFields: (keyof NewCatalogItem)[] = ['links', 'reviews', 'qas'];
  for (const field of jsonFields) {
    if (fieldMap[field as string] !== undefined && values[fieldMap[field as string]]) {
      try {
        item[field] = safeJsonParse(values[fieldMap[field as string]]);
      } catch {
        (item as any)[field] = [];
      }
    }
  }

  // Techs + fallback for weight
  const techsStr = fieldMap.techs !== undefined ? values[fieldMap.techs] : undefined;
  if (techsStr) {
    try {
      const parsed = safeJsonParse(techsStr);
      item.techs = parsed;

      if (!item.weight) {
        const claimedWeight = parsed['Claimed Weight'] || parsed.weight;
        if (claimedWeight) {
          const { weight, unit } = parseWeight(claimedWeight);
          item.weight = weight;
          item.weightUnit = unit;
        }
      }
    } catch {
      item.techs = {};
    }
  }

  // Direct mappings
  const directFields: (keyof NewCatalogItem)[] = [
    'brand',
    'model',
    'color',
    'size',
    'sku',
    'productSku',
    'availability',
    'seller',
    'material',
    'condition',
  ];
  for (const field of directFields) {
    const index = fieldMap[field as string];
    if (index !== undefined && values[index]) {
      (item as any)[field] = values[index].replace(/^"|"$/g, '').trim();
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

function safeJsonParse(value: string): any {
  if (!value || value === 'undefined' || value === 'null') return [];

  const normalized = normalizeJsonString(value);

  try {
    return JSON.parse(normalized);
  } catch (err) {
    console.warn('❌ Failed to parse JSON:\n', err);
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

async function insertCatalogItems({
  env,
  items,
  jobId,
}: {
  env: Env;
  items: Partial<NewCatalogItem>[];
  userId: string;
  jobId: string;
}): Promise<void> {
  const db = createDbClient(env);
  console.log(`Job ${jobId}: Inserting ${items.length} catalog items`);

  const validItems = items.filter((i): i is NewCatalogItem => !!i.name && !!i.sku?.trim());
  if (validItems.length === 0) {
    console.log(`Job ${jobId}: No valid items to insert.`);
    return;
  }

  const columns = getTableColumns(catalogItems);
  const updateSet: Record<string, SQL> = {};
  for (const col of Object.values(columns)) {
    const name = col.name as keyof NewCatalogItem;
    if (!['sku', 'createdAt', 'id'].includes(name)) {
      updateSet[name] = sql.raw(`excluded."${name}"`);
    }
  }

  await db
    .delete(catalogItems)
    .where(or(isNull(catalogItems.sku), eq(sql`trim(${catalogItems.sku})`, '')));

  console.log('🧹 Removed catalog items with null or empty SKU');

  await db.insert(catalogItems).values(validItems).onConflictDoUpdate({
    target: catalogItems.sku,
    set: updateSet,
  });

  console.log(`Job ${jobId}: Inserted/updated ${validItems.length} items.`);
}
