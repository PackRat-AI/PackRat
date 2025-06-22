import { Env } from "@/types/env";
import { Queue } from "@cloudflare/workers-types";

export enum QueueType {
  CATALOG_ETL = "catalog-etl",
}

export interface BaseQueueMessage {
  type: QueueType;
  timestamp: number;
  id: string;
}

export interface CatalogETLMessage extends BaseQueueMessage {
  type: QueueType.CATALOG_ETL;
  data: {
    r2Key: string;
    userId: string;
    filename: string;
  };
}

const BATCH_SIZE = 1000; // Process 1000 rows at a time
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
  r2Key,
  userId,
  filename,
}: {
  queue: Queue;
  r2Key: string;
  userId: string;
  filename: string;
}): Promise<string> {
  const jobId = crypto.randomUUID();

  const message: CatalogETLMessage = {
    type: QueueType.CATALOG_ETL,
    data: { r2Key, userId, filename },
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
  batch: any;
  env: Env;
}): Promise<void> {
  for (const message of batch.messages) {
    try {
      const queueMessage: BaseQueueMessage = message.body;

      switch (queueMessage.type) {
        case QueueType.CATALOG_ETL:
          if (!env.ETL_QUEUE) {
            throw new Error("ETL_QUEUE is not configured");
          }

          await processCatalogETL({
            message: queueMessage as CatalogETLMessage,
            queue: env.ETL_QUEUE,
          });

          break;
        default:
          console.warn(`Unknown queue message type: ${queueMessage.type}`);
      }
    } catch (error) {
      console.error("Error processing queue message:", error);
    }
  }
}

async function processCatalogETL({
  message,
  queue,
}: {
  message: CatalogETLMessage;
  queue: Queue;
}): Promise<void> {
  const { r2Key, userId, filename } = message.data;
  const jobId = message.id;

  console.log(`Starting ETL job ${jobId} for file ${filename}`);

  try {
    // Get the full file from R2 (could also stream this)
    const csvContent = await getR2File({ queue, key: r2Key });

    // Parse headers and create field mapping
    const lines = csvContent.split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header and one data row");
    }

    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map((h) => h.trim().toLowerCase());
    const fieldMap = createFieldMap(headers);

    console.log(
      `Processing ${lines.length - 1} rows with field mapping:`,
      fieldMap
    );

    // Process in batches
    let batch: any[] = [];
    let totalProcessed = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const item = mapCsvRowToItem({ values, fieldMap });

      if (item) {
        batch.push(item);
      }

      // Process batch when it reaches BATCH_SIZE or we're at the end
      if (batch.length >= BATCH_SIZE || i === lines.length - 1) {
        if (batch.length > 0) {
          await insertCatalogItems({ queue, items: batch, userId, jobId });
          totalProcessed += batch.length;
          console.log(
            `ETL job ${jobId}: Processed ${totalProcessed} items so far`
          );
          batch = [];
        }
      }
    }

    console.log(
      `ETL job ${jobId} completed: Processed ${totalProcessed} total items`
    );
  } catch (error) {
    console.error(`ETL job ${jobId} failed:`, error);
    throw error;
  }
}

async function getR2File({
  queue,
  key,
}: {
  queue: Queue;
  key: string;
}): Promise<string> {
  // This would get the full file from R2
  // For 500MB+ files, you might want to stream this instead
  console.log(`Getting R2 file: ${key}`);

  // Placeholder - you'll implement actual R2 fetch here
  // const object = await env.R2_BUCKET.get(key);
  // return await object.text();

  return "name,description,weight\nTest Item,A test item,100g\nAnother Item,Another test,200g";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Handle escaped quotes
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((field) => field.trim());
}

function createFieldMap(headers: string[]): Record<string, number> {
  const fieldMap: Record<string, number> = {};

  const mappings = {
    name: ["name", "item_name", "product_name", "title", "product", "item"],
    description: ["description", "desc", "details", "summary", "info"],
    weight: ["weight", "weight_grams", "weight_oz", "wt", "mass"],
    category: ["category", "type", "category_name", "cat"],
    brand: ["brand", "manufacturer", "company", "make"],
    model: ["model", "model_number", "sku", "part_number"],
    price: ["price", "cost", "amount", "price_usd", "msrp"],
    image: ["image", "image_url", "photo", "picture", "img"],
    url: ["url", "link", "product_url", "website", "web"],
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
}): any {
  const item: any = {};
  let hasRequiredFields = false;

  for (const [dbField, csvIndex] of Object.entries(fieldMap)) {
    if (csvIndex < values.length && values[csvIndex]) {
      let value = values[csvIndex].replace(/^"|"$/g, ""); // Remove surrounding quotes

      if (dbField === "weight") {
        value = parseWeight(value).toString();
      } else if (dbField === "price") {
        value = parsePrice(value).toString();
      }

      item[dbField] = value;
      if (dbField === "name") hasRequiredFields = true;
    }
  }

  return hasRequiredFields ? item : null;
}

function parseWeight(weightStr: string): number {
  const weight = parseFloat(weightStr.replace(/[^0-9.]/g, ""));
  if (isNaN(weight)) return 0;

  if (weightStr.toLowerCase().includes("oz")) {
    return Math.round(weight * 28.35);
  }

  return weight;
}

function parsePrice(priceStr: string): number {
  const price = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return isNaN(price) ? 0 : price;
}

async function insertCatalogItems({
  queue,
  items,
  userId,
  jobId,
}: {
  queue: Queue;
  items: any[];
  userId: string;
  jobId: string;
}): Promise<void> {
  // This would batch insert items into your database
  // Use your existing database connection and catalog table
  console.log(
    `Inserting ${items.length} catalog items for user ${userId}, job ${jobId}`
  );

  if (items.length > 0) {
    console.log("Sample items:", items.slice(0, 2));
  }

  // TODO: Implement actual database insertion
  // Example:
  // await db.insert(catalogTable).values(items);
}
