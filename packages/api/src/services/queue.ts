import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import { catalogItems, type NewCatalogItem } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { parse } from 'csv-parse/sync';
import { eq, getTableColumns, isNull, or, type SQL, sql } from 'drizzle-orm';
import { createDbClient } from '../db';
import { R2BucketService } from './r2-bucket';

export enum QueueType {
  CATALOG_ETL = 'catalog-etl',
  CATALOG_ETL_WRITE_BATCH = 'catalog-etl-write-batch',
  BUCKET_TRANSFER_INIT = 'bucket-transfer-init',
  BUCKET_TRANSFER_BUCKET = 'bucket-transfer-bucket',
  BUCKET_TRANSFER_OBJECT = 'bucket-transfer-object',
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

export interface BucketTransferInitMessage extends BaseQueueMessage {
  type: QueueType.BUCKET_TRANSFER_INIT;
  data: {
    sourceAccountId?: string;
    sourceAccessKeyId?: string;
    sourceSecretAccessKey?: string;
    destinationAccountId?: string;
    destinationAccessKeyId?: string;
    destinationSecretAccessKey?: string;
    bucketNames?: string[]; // If empty, transfer all buckets
    userId: string;
  };
}

export interface BucketTransferBucketMessage extends BaseQueueMessage {
  type: QueueType.BUCKET_TRANSFER_BUCKET;
  data: {
    sourceBucketName: string;
    destinationBucketName: string;
    sourceAccountId?: string;
    sourceAccessKeyId?: string;
    sourceSecretAccessKey?: string;
    destinationAccountId?: string;
    destinationAccessKeyId?: string;
    destinationSecretAccessKey?: string;
    userId: string;
  };
}

export interface BucketTransferObjectMessage extends BaseQueueMessage {
  type: QueueType.BUCKET_TRANSFER_OBJECT;
  data: {
    sourceBucketName: string;
    destinationBucketName: string;
    objectKey: string;
    sourceAccountId?: string;
    sourceAccessKeyId?: string;
    sourceSecretAccessKey?: string;
    destinationAccountId?: string;
    destinationAccessKeyId?: string;
    destinationSecretAccessKey?: string;
    userId: string;
  };
}

const BATCH_SIZE = 10; // Process 10 rows at a time to stay under 128KB message limit
const OBJECT_BATCH_SIZE = 100; // Process 100 objects at a time for bucket transfers
const MAX_MESSAGES_PER_SECOND = 5000;
const DELAY_MS = Math.max(1, Math.ceil((1000 * OBJECT_BATCH_SIZE) / MAX_MESSAGES_PER_SECOND));
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

export async function queueBucketTransfer({
  queue,
  sourceAccountId,
  sourceAccessKeyId,
  sourceSecretAccessKey,
  destinationAccountId,
  destinationAccessKeyId,
  destinationSecretAccessKey,
  bucketNames,
  userId,
}: {
  queue: Queue;
  sourceAccountId?: string;
  sourceAccessKeyId?: string;
  sourceSecretAccessKey?: string;
  destinationAccountId?: string;
  destinationAccessKeyId?: string;
  destinationSecretAccessKey?: string;
  bucketNames?: string[];
  userId: string;
}): Promise<string> {
  const jobId = crypto.randomUUID();

  const message: BucketTransferInitMessage = {
    type: QueueType.BUCKET_TRANSFER_INIT,
    data: {
      sourceAccountId,
      sourceAccessKeyId,
      sourceSecretAccessKey,
      destinationAccountId,
      destinationAccessKeyId,
      destinationSecretAccessKey,
      bucketNames,
      userId,
    },
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

        case QueueType.BUCKET_TRANSFER_INIT:
          if (!env.BUCKET_TRANSFER_QUEUE)
            throw new Error('BUCKET_TRANSFER_QUEUE is not configured');
          await processBucketTransferInit({
            message: queueMessage as BucketTransferInitMessage,
            env,
          });
          break;

        case QueueType.BUCKET_TRANSFER_BUCKET:
          if (!env.BUCKET_TRANSFER_QUEUE)
            throw new Error('BUCKET_TRANSFER_QUEUE is not configured');
          await processBucketTransferBucket({
            message: queueMessage as BucketTransferBucketMessage,
            env,
            msgOriginal: message,
          });
          break;

        case QueueType.BUCKET_TRANSFER_OBJECT:
          await processBucketTransferObject({
            message: queueMessage as BucketTransferObjectMessage,
            env,
            msgOriginal: message,
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

async function processBucketTransferInit({
  message,
  env,
}: {
  message: BucketTransferInitMessage;
  env: Env;
}): Promise<void> {
  const {
    sourceAccountId,
    sourceAccessKeyId,
    sourceSecretAccessKey,
    destinationAccountId,
    destinationAccessKeyId,
    destinationSecretAccessKey,
    bucketNames,
    userId,
  } = message.data;
  const jobId = message.id;

  console.log(`Starting bucket transfer job ${jobId}`);

  // Create R2 service for source account
  const sourceR2Service = new R2BucketService({
    env,
    bucketType: 'custom',
    config: {
      useOrgCredentials: false,
      accountId: sourceAccountId,
      accessKeyId: sourceAccessKeyId,
      secretAccessKey: sourceSecretAccessKey,
    },
  });

  let bucketsToTransfer: string[] = [];

  if (bucketNames && bucketNames.length > 0) {
    bucketsToTransfer = bucketNames;
    console.log(`Job ${jobId}: Transferring specified buckets:`, bucketsToTransfer);
  } else {
    // List all buckets from source account
    try {
      const buckets = await sourceR2Service.listBuckets();
      bucketsToTransfer = buckets.map((bucket) => bucket.name);
      console.log(
        `Job ${jobId}: Found ${bucketsToTransfer.length} buckets to transfer:`,
        bucketsToTransfer,
      );
    } catch (error) {
      console.error(`Job ${jobId}: Error listing buckets:`, error);
      throw error;
    }
  }

  // Queue individual bucket transfer jobs
  for (const bucketName of bucketsToTransfer) {
    const bucketTransferMessage: BucketTransferBucketMessage = {
      type: QueueType.BUCKET_TRANSFER_BUCKET,
      id: jobId,
      timestamp: Date.now(),
      data: {
        sourceBucketName: bucketName,
        destinationBucketName: bucketName, // Keep same name
        sourceAccountId,
        sourceAccessKeyId,
        sourceSecretAccessKey,
        destinationAccountId,
        destinationAccessKeyId,
        destinationSecretAccessKey,
        userId,
      },
    };

    await env.BUCKET_TRANSFER_QUEUE.send(bucketTransferMessage);
  }

  console.log(`Job ${jobId}: Queued ${bucketsToTransfer.length} bucket transfer jobs`);
}

async function processBucketTransferBucket({
  message,
  env,
  msgOriginal,
}: {
  message: BucketTransferBucketMessage;
  env: Env;
  msgOriginal: Message<BaseQueueMessage>;
}): Promise<void> {
  const {
    sourceBucketName,
    destinationBucketName,
    sourceAccountId,
    sourceAccessKeyId,
    sourceSecretAccessKey,
    destinationAccountId,
    destinationAccessKeyId,
    destinationSecretAccessKey,
    userId,
  } = message.data;
  const jobId = message.id;

  console.log(
    `Job ${jobId}: Starting transfer of bucket ${sourceBucketName} -> ${destinationBucketName}`,
  );

  // Create R2 services for source and destination
  const sourceR2Service = new R2BucketService({
    env,
    bucketType: 'custom',
    config: {
      useOrgCredentials: false,
      accountId: sourceAccountId,
      accessKeyId: sourceAccessKeyId,
      secretAccessKey: sourceSecretAccessKey,
      bucketName: sourceBucketName,
    },
  });

  const destinationR2Service = new R2BucketService({
    env,
    bucketType: 'custom',
    config: {
      useOrgCredentials: true,
      accountId: destinationAccountId,
      accessKeyId: destinationAccessKeyId,
      secretAccessKey: destinationSecretAccessKey,
      bucketName: destinationBucketName,
    },
  });

  try {
    // Create destination bucket with same configuration
    await destinationR2Service.createBucket(destinationBucketName);
    console.log(`Job ${jobId}: Created destination bucket ${destinationBucketName}`);

    // Copy bucket configuration (CORS, lifecycle, etc.)
    await copyBucketConfiguration(sourceR2Service, destinationR2Service, jobId);

    // List all objects in source bucket
    const objects = await sourceR2Service.listObjects();
    console.log(`Job ${jobId}: Found ${objects.length} objects in bucket ${sourceBucketName}`);

    let batchCount = 0;
    const totalBatches = Math.ceil(objects.length / OBJECT_BATCH_SIZE);

    for (let i = 0; i < objects.length; i += OBJECT_BATCH_SIZE) {
      const batch = objects.slice(i, i + OBJECT_BATCH_SIZE);

      // Prepare messages for sendBatch
      const messages = batch.map((obj) => {
        const objectTransferMessage: BucketTransferObjectMessage = {
          type: QueueType.BUCKET_TRANSFER_OBJECT,
          id: jobId,
          timestamp: Date.now(),
          data: {
            sourceBucketName,
            destinationBucketName,
            objectKey: obj.key,
            sourceAccountId,
            sourceAccessKeyId,
            sourceSecretAccessKey,
            destinationAccountId,
            destinationAccessKeyId,
            destinationSecretAccessKey,
            userId,
          },
        };
        return { body: objectTransferMessage };
      });

      // Send batch of messages
      await env.BUCKET_TRANSFER_QUEUE.sendBatch(messages);

      batchCount++;
      console.log(
        `Job ${jobId}: Queued batch ${batchCount}/${totalBatches} (${batch.length} objects)`,
      );

      // Dynamic delay based on throughput limit - only delay if not the last batch
      if (i + OBJECT_BATCH_SIZE < objects.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(
      `Job ${jobId}: Queued ${objects.length} object transfers for bucket ${sourceBucketName}`,
    );
  } catch (error) {
    console.error(`Job ${jobId}: Error transferring bucket ${sourceBucketName}:`, error);
    msgOriginal.retry();
  }
}

async function processBucketTransferObject({
  message,
  env,
  msgOriginal,
}: {
  message: BucketTransferObjectMessage;
  env: Env;
  msgOriginal: Message<BaseQueueMessage>;
}): Promise<void> {
  const {
    sourceBucketName,
    destinationBucketName,
    objectKey,
    sourceAccountId,
    sourceAccessKeyId,
    sourceSecretAccessKey,
    destinationAccountId,
    destinationAccessKeyId,
    destinationSecretAccessKey,
  } = message.data;
  const jobId = message.id;

  try {
    // Create R2 services for source and destination
    const sourceR2Service = new R2BucketService({
      env,
      bucketType: 'custom',
      config: {
        useOrgCredentials: false,
        accountId: sourceAccountId,
        accessKeyId: sourceAccessKeyId,
        secretAccessKey: sourceSecretAccessKey,
        bucketName: sourceBucketName,
      },
    });

    const destinationR2Service = new R2BucketService({
      env,
      bucketType: 'custom',
      config: {
        useOrgCredentials: true,
        accountId: destinationAccountId,
        accessKeyId: destinationAccessKeyId,
        secretAccessKey: destinationSecretAccessKey,
        bucketName: destinationBucketName,
      },
    });

    // Get object from source
    const sourceObject = await sourceR2Service.get(objectKey);
    if (!sourceObject) {
      console.warn(
        `Job ${jobId}: Object ${objectKey} not found in source bucket ${sourceBucketName}`,
      );
      return;
    }

    // Get object metadata
    const metadata = {
      contentType: sourceObject.httpMetadata?.contentType,
      contentLanguage: sourceObject.httpMetadata?.contentLanguage,
      contentDisposition: sourceObject.httpMetadata?.contentDisposition,
      contentEncoding: sourceObject.httpMetadata?.contentEncoding,
      cacheControl: sourceObject.httpMetadata?.cacheControl,
      expires: sourceObject.httpMetadata?.expires,
      customMetadata: sourceObject.customMetadata,
    };

    // Copy object to destination with same metadata and folder structure
    await destinationR2Service.put(objectKey, sourceObject.body, {
      httpMetadata: {
        contentType: metadata.contentType,
        contentLanguage: metadata.contentLanguage,
        contentDisposition: metadata.contentDisposition,
        contentEncoding: metadata.contentEncoding,
        cacheControl: metadata.cacheControl,
        expires: metadata.expires,
      },
      customMetadata: metadata.customMetadata,
    });

    console.log(
      `Job ${jobId}: Copied object ${objectKey} from ${sourceBucketName} to ${destinationBucketName}`,
    );
  } catch (error) {
    console.error(`Job ${jobId}: Error copying object ${objectKey}:`, error);
    msgOriginal.retry();
  }
}

async function copyBucketConfiguration(
  sourceR2Service: R2BucketService,
  destinationR2Service: R2BucketService,
  jobId: string,
): Promise<void> {
  try {
    // Copy CORS configuration
    const corsConfig = await sourceR2Service.getBucketCors();
    if (corsConfig) {
      await destinationR2Service.setBucketCors(corsConfig);
      console.log(`Job ${jobId}: Copied CORS configuration`);
    }

    // Copy lifecycle configuration
    const lifecycleConfig = await sourceR2Service.getBucketLifecycle();
    if (lifecycleConfig) {
      await destinationR2Service.setBucketLifecycle(lifecycleConfig);
      console.log(`Job ${jobId}: Copied lifecycle configuration`);
    }

    console.log(`Job ${jobId}: Successfully copied bucket configurations`);
  } catch (error) {
    console.warn(`Job ${jobId}: Error copying bucket configuration:`, error);
    // Don't throw here as this is not critical for the transfer
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
    bucketType: 'items',
    config: {
      useOrgCredentials: false,
    },
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

  if (weightStr && Number.parseFloat(weightStr) > 0) {
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
    item.ratingValue = Number.parseFloat(ratingStr) || null;
  }

  const imageUrl = fieldMap.image !== undefined ? values[fieldMap.image] : undefined;
  if (imageUrl) {
    const parsedImage = parseJsonOrString(imageUrl);
    if (Array.isArray(parsedImage)) {
      item.image = parsedImage[0];
    } else if (typeof parsedImage === 'string') {
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
        const claimedWeight = parsedTechs['Claimed Weight'] || parsedTechs.weight;
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

function parseJsonOrString(str: string): string | object {
  try {
    return JSON.parse(str);
  } catch (_e) {
    return str;
  }
}

function parseAndFormatMultiString(str: string): string {
  if (!str) return '';
  const parsed = parseJsonOrString(str);
  if (Array.isArray(parsed)) {
    return parsed.join(', ');
  } else if (typeof parsed === 'string') return parsed;
  return '';
}

function parseWeight(
  weightStr: string,
  unitStr?: string,
): { weight: number | null; unit: string | null } {
  if (!weightStr) return { weight: null, unit: null };

  const weightVal = Number.parseFloat(weightStr);
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

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const price = Number.parseFloat(priceStr.replace(/[^0-9.]/g, ''));
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
