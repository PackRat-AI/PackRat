import { createDbClient } from '@packrat/api/db';
import { processCatalogETL } from '@packrat/api/services/etl/processCatalogEtl';
import { processValidItemsBatch } from '@packrat/api/services/etl/processValidItemsBatch';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { catalogItems, etlJobs, invalidItemLogs } from '@packrat/db';
import { count, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

// ── CSV helpers ───────────────────────────────────────────────────────────────

const CSV_HEADER = 'name,sku,productUrl,brand,price,weight,weightUnit\n';
const CSV_ROW = (i: number) =>
  `Test Item ${i},SKU-${i},https://example.com/item-${i},TestBrand,49.99,500,g\n`;

function makeCsv(rows: number): string {
  return CSV_HEADER + Array.from({ length: rows }, (_, i) => CSV_ROW(i)).join('');
}

function makeReadableStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

// ── Mock R2BucketService to return a CSV stream ───────────────────────────────

function mockR2WithCsv(csv: string) {
  vi.mocked(R2BucketService).mockImplementationOnce(
    () =>
      ({
        get: vi.fn().mockResolvedValue({ body: makeReadableStream(csv) }),
      }) as any,
  );
}

function mockR2WithNull() {
  vi.mocked(R2BucketService).mockImplementationOnce(
    () =>
      ({
        get: vi.fn().mockResolvedValue(null),
      }) as any,
  );
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function insertJob(jobId: string) {
  const db = createDbClient({} as any);
  await db.insert(etlJobs).values({
    id: jobId,
    status: 'running',
    source: 'test',
    filename: 'test.csv',
    scraperRevision: 'abc123',
    startedAt: new Date(),
  });
}

async function getJob(jobId: string) {
  const db = createDbClient({} as any);
  const rows = await db.select().from(etlJobs).where(eq(etlJobs.id, jobId));
  return rows[0];
}

// minimal env — createDbClient and R2BucketService are both globally mocked
const TEST_ENV = {
  NEON_DATABASE_URL: 'postgres://test_user:test_password@localhost:5432/packrat_test',
  OPENAI_API_KEY: 'sk-test',
  AI_PROVIDER: 'openai',
  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway-id',
} as unknown as Parameters<typeof processCatalogETL>[0]['env'];

function makeMessage(jobId: string) {
  return { id: jobId, data: { objectKey: 'v2/test/test.csv' } };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('processCatalogETL', () => {
  it('marks job as completed after processing a valid CSV', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    mockR2WithCsv(makeCsv(5));

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const job = await getJob(jobId);
    expect(job?.status, 'job should be completed, not failed').toBe('completed');
    expect(job?.completedAt).not.toBeNull();
    expect(job?.totalProcessed).toBe(5);
  });

  it('writes catalog items to the DB', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    mockR2WithCsv(makeCsv(3));

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const db = createDbClient({} as any);
    const [result] = await db.select({ total: count() }).from(catalogItems);
    expect(result?.total).toBeGreaterThanOrEqual(3);
  });

  it('marks job as completed when all rows are invalid (writes invalid logs)', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    // Missing sku and productUrl → all rows invalid
    mockR2WithCsv('name,brand\nItem Without SKU,TestBrand\n');

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const job = await getJob(jobId);
    expect(job?.status, 'job with only invalid rows should still complete').toBe('completed');

    const db = createDbClient({} as any);
    const [logResult] = await db
      .select({ total: count() })
      .from(invalidItemLogs)
      .where(eq(invalidItemLogs.jobId, jobId));
    expect(logResult?.total).toBeGreaterThan(0);
  });

  it('marks job as failed and rethrows when R2 object is missing', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    mockR2WithNull();

    await expect(
      processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV }),
    ).rejects.toThrow();

    const job = await getJob(jobId);
    expect(job?.status).toBe('failed');
  });

  it('handles exactly BATCH_SIZE rows (no remainder flush — edge case)', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    mockR2WithCsv(makeCsv(100));

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const job = await getJob(jobId);
    expect(job?.status, 'exact BATCH_SIZE rows should complete').toBe('completed');
    expect(job?.totalProcessed).toBe(100);
  });

  it('handles rows spanning multiple batches', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    mockR2WithCsv(makeCsv(250));

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const job = await getJob(jobId);
    expect(job?.status).toBe('completed');
    expect(job?.totalProcessed).toBe(250);
  });

  it('totalProcessed never exceeds totalValid + totalInvalid after completion', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    mockR2WithCsv(makeCsv(10));

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const job = await getJob(jobId);
    const processed = job?.totalProcessed ?? 0;
    const valid = job?.totalValid ?? 0;
    const invalid = job?.totalInvalid ?? 0;
    expect(processed).toBe(valid + invalid);
  });

  it('marks job as completed even when items have no weight', async () => {
    const jobId = crypto.randomUUID();
    await insertJob(jobId);
    // No weight column — valid items that previously caused NOT NULL DB failures
    mockR2WithCsv(
      'name,sku,productUrl,brand\nNo Weight Item,SKU-NW,https://example.com/nw,TestBrand\n',
    );

    await processCatalogETL({ message: makeMessage(jobId) as any, env: TEST_ENV });

    const job = await getJob(jobId);
    expect(job?.status, 'items without weight should not cause job failure').toBe('completed');
  });
});

describe('processValidItemsBatch', () => {
  it('does not throw when embedding generation fails (falls back gracefully)', async () => {
    const jobId = crypto.randomUUID();
    const db = createDbClient({} as any);
    await db.insert(etlJobs).values({
      id: jobId,
      status: 'running',
      source: 'test',
      filename: 'test.csv',
      scraperRevision: 'abc123',
      startedAt: new Date(),
    });

    const { generateManyEmbeddings } = await import('@packrat/api/services/embeddingService');
    vi.mocked(generateManyEmbeddings).mockRejectedValueOnce(new Error('OpenAI rate limit'));

    await expect(
      processValidItemsBatch({
        jobId,
        items: [
          {
            name: 'Test Item',
            sku: 'SKU-EMBED-001',
            productUrl: 'https://example.com/item',
            brand: 'TestBrand',
            weight: 500,
            weightUnit: 'g',
          } as any,
        ],
        env: TEST_ENV,
      }),
    ).resolves.not.toThrow();
  });

  it('does not throw when items have no weight', async () => {
    const jobId = crypto.randomUUID();
    const db = createDbClient({} as any);
    await db.insert(etlJobs).values({
      id: jobId,
      status: 'running',
      source: 'test',
      filename: 'test.csv',
      scraperRevision: 'abc123',
      startedAt: new Date(),
    });

    await expect(
      processValidItemsBatch({
        jobId,
        items: [
          {
            name: 'No Weight Item',
            sku: 'SKU-NW-002',
            productUrl: 'https://example.com/nw',
            brand: 'TestBrand',
          } as any,
        ],
        env: TEST_ENV,
      }),
    ).resolves.not.toThrow();
  });
});
