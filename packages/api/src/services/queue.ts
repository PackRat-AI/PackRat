import type { Queue } from '@cloudflare/workers-types';
import { catalogItems, type NewCatalogItem } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { parse } from 'csv-parse/sync';
import { getTableColumns, sql } from 'drizzle-orm';
import { createDbClient } from '../db';

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
    items: any[];
    userId: string;
  };
}

const BATCH_SIZE = 10; // Process 10 rows at a time to stay under 128KB message limit
const CHUNK_SIZE = 5 * 1024 * 1024; // Read 5MB chunks from R2

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

export async function processQueueBatch({ batch, env }: { batch: any; env: Env }): Promise<void> {
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

  // Use R2 bucket binding instead of S3 client
  const { PACKRAT_ITEMS_BUCKET } = env;

  const object = await PACKRAT_ITEMS_BUCKET.get(objectKey);

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
  let batch: any[] = [];
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

async function processCatalogETLWriteBatch({
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
    weightUnit: ['weight_unit'],
    category: [
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
    productSku: ['product_sku'],
    price: ['price', 'cost', 'amount', 'price_usd', 'msrp', 'Price', 'PRICE', 'Cost'],
    image: [
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
    productUrl: ['product_url', 'PRODUCT_URL'],
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
    ratingValue: ['rating', 'rating_value', 'stars', 'average_rating'],
    techs: ['techs'],
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

  const name = fieldMap.name !== undefined ? values[fieldMap.name]?.trim() : undefined;
  if (!name) {
    return null; // A name is required
  }
  item.name = name;

  const descriptionParts: string[] = [];
  if (fieldMap.description !== undefined && values[fieldMap.description]) {
    descriptionParts.push(values[fieldMap.description].replace(/^"|"$/g, ''));
  }
  if (fieldMap.details !== undefined && values[fieldMap.details]) {
    descriptionParts.push(`Details: ${values[fieldMap.details].replace(/^"|"$/g, '')}`);
  }
  if (fieldMap.parameters !== undefined && values[fieldMap.parameters]) {
    descriptionParts.push(`Parameters: ${parseAndFormatMultiString(values[fieldMap.parameters])}`);
  }
  if (descriptionParts.length > 0) {
    item.description = descriptionParts.join('\n\n');
  }

  // --- Direct Mappings ---
  const directMappings: (keyof NewCatalogItem)[] = [
    'category',
    'brand',
    'model',
    'url',
    'productUrl',
    'color',
    'size',
    'sku',
    'productSku',
    'availability',
    'seller',
    'material',
    'currency',
    'condition',
  ];
  for (const key of directMappings) {
    const fieldIndex = fieldMap[key as string];
    if (fieldIndex !== undefined && values[fieldIndex]) {
      // @ts-expect-error - We are mapping strings to the correct keys
      item[key] = values[fieldIndex].replace(/^"|"$/g, '').trim();
    }
  }

  // --- Transformed Mappings ---
  const weightStr = fieldMap.weight !== undefined ? values[fieldMap.weight] : undefined;
  const unitStr = fieldMap.weightUnit !== undefined ? values[fieldMap.weightUnit] : undefined;

  if (weightStr && parseFloat(weightStr) > 0) {
    const { weight, unit } = parseWeight(weightStr, unitStr);
    item.defaultWeight = weight;
    item.defaultWeightUnit = unit;
  }

  const priceStr = fieldMap.price !== undefined ? values[fieldMap.price] : undefined;
  if (priceStr) {
    item.price = parsePrice(priceStr);
  }

  const ratingStr = fieldMap.ratingValue !== undefined ? values[fieldMap.ratingValue] : undefined;
  if (ratingStr) {
    item.ratingValue = parseFloat(ratingStr) || null;
  }

  const imageUrl = fieldMap.image !== undefined ? values[fieldMap.image] : undefined;
  if (imageUrl) {
    const parsedImage = parseJsonOrString(imageUrl);
    if (Array.isArray(parsedImage)) {
      item.image = parsedImage[0];
    } else {
      item.image = parsedImage.split(',')[0].trim();
    }
  }

  const techsStr = fieldMap.techs !== undefined ? values[fieldMap.techs] : undefined;
  if (techsStr) {
    try {
      const parsedTechs = JSON.parse(techsStr);
      item.techs = parsedTechs;

      // Fallback weight parsing from techs
      if (!item.defaultWeight) {
        const claimedWeight = parsedTechs['Claimed Weight'] || parsedTechs['weight'];
        if (claimedWeight) {
          const { weight, unit } = parseWeight(claimedWeight);
          item.defaultWeight = weight;
          item.defaultWeightUnit = unit;
        }
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  if (item.description) {
    item.description = item.description
      .replace(/[\r\n]+/g, ' ')
      .replace(/Details:\s*Item\s+#\S+/gi, '')
      .trim();
  }

  return item;
}

function parseJsonOrString(str: string): any {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

function parseAndFormatMultiString(str: string): string {
  if (!str) return '';
  const parsed = parseJsonOrString(str);
  if (Array.isArray(parsed)) {
    return parsed.join(', ');
  }
  return parsed;
}

function parseWeight(
  weightStr: string,
  unitStr?: string,
): { weight: number | null; unit: string | null } {
  if (!weightStr) return { weight: null, unit: null };

  const weightVal = parseFloat(weightStr);
  if (isNaN(weightVal) || weightVal < 0) {
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

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return isNaN(price) ? null : price;
}

async function insertCatalogItems({
  env,
  items,
  userId,
  jobId,
}: {
  env: Env;
  items: Partial<NewCatalogItem>[];
  userId: string;
  jobId: string;
}): Promise<void> {
  const db = createDbClient(env);
  console.log(`Job ${jobId}: Inserting ${items.length} catalog items`);

  const validItems = items.filter((i): i is NewCatalogItem => !!i.name);
  if (validItems.length === 0) {
    console.log(`Job ${jobId}: No valid items to insert.`);
    return;
  }

  const columns = getTableColumns(catalogItems);
  const updateSet: Record<string, any> = {};
  for (const col of Object.values(columns)) {
    const name = col.name as keyof NewCatalogItem;
    if (!['sku', 'createdAt', 'id'].includes(name)) {
      updateSet[name] = sql.raw(`excluded."${name}"`);
    }
  }

  await db.insert(catalogItems).values(validItems).onConflictDoUpdate({
    target: catalogItems.sku,
    set: updateSet,
  });

  console.log(`Job ${jobId}: Inserted/updated ${validItems.length} items.`);
}
