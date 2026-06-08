import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processValidItemsBatch } from '../processValidItemsBatch';

// ---------------------------------------------------------------------------
// Mocks
//
// Cover the partition + skip-redundant-embedding logic without a real DB.
// Service collaborators are mocked at module load so we can drive existing-
// row state and assert which items reach generateManyEmbeddings.
// ---------------------------------------------------------------------------

const mockFetchExistingForRegen = vi.fn();
const mockUpsertCatalogItems = vi.fn();
const mockTrackEtlJob = vi.fn();

vi.mock('../../catalogService', () => ({
  CatalogService: vi.fn().mockImplementation(function (this: unknown) {
    return {
      fetchExistingForRegen: mockFetchExistingForRegen,
      upsertCatalogItems: mockUpsertCatalogItems,
      trackEtlJob: mockTrackEtlJob,
    };
  }),
}));

const mockGenerateManyEmbeddings = vi.fn();
vi.mock('../../embeddingService', () => ({
  generateManyEmbeddings: (...args: unknown[]) => mockGenerateManyEmbeddings(...args),
}));

vi.mock('../updateEtlJobProgress', () => ({
  updateEtlJobProgress: vi.fn(),
}));

vi.mock('../mergeItemsBySku', () => ({
  // Identity merge — each item already has a unique SKU in test fixtures.
  mergeItemsBySku: (items: unknown[]) => items,
}));

vi.mock('@packrat/api/db', () => ({
  createDbClient: vi.fn(() => {
    const db = {
      tag: (_label: string) => db,
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    };
    return db;
  }),
}));

vi.mock('@packrat/api/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_ENV = {
  OPENAI_API_KEY: 'sk-test',
  AI_PROVIDER: 'openai',
  CLOUDFLARE_ACCOUNT_ID: 'acct',
  CLOUDFLARE_AI_GATEWAY_ID: 'gw',
  CLOUDFLARE_API_TOKEN: 'token',
  AI: {},
} as unknown as Parameters<typeof processValidItemsBatch>[0]['env'];

const makeItem = (sku: string, overrides: Record<string, unknown> = {}) => ({
  sku,
  name: `Item ${sku}`,
  description: `desc ${sku}`,
  productUrl: `https://example.com/${sku}`,
  brand: 'Brand',
  weight: 100,
  weightUnit: 'g' as const,
  ...overrides,
});

const fakeEmbedding = (seed: number): number[] =>
  Array.from({ length: 1536 }, (_, i) => (i + seed) / 1536);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processValidItemsBatch — source-text diff', () => {
  beforeEach(() => {
    mockFetchExistingForRegen.mockReset();
    mockUpsertCatalogItems.mockReset();
    mockTrackEtlJob.mockReset();
    mockGenerateManyEmbeddings.mockReset();
    mockUpsertCatalogItems.mockResolvedValue([{ id: 1, sku: 'A' }]);
    mockTrackEtlJob.mockResolvedValue(undefined);
  });

  it('calls generateManyEmbeddings only for items whose source text changed (or are new)', async () => {
    const items = [
      makeItem('NEW-1'), // brand new → fresh embedding
      makeItem('CHANGED-1', { description: 'NEW desc' }), // existing but text changed
      makeItem('UNCHANGED-1'), // existing + source text identical
    ];

    const existingForUnchanged = makeItem('UNCHANGED-1');
    mockFetchExistingForRegen.mockResolvedValue(
      new Map([
        [
          'CHANGED-1',
          { ...makeItem('CHANGED-1', { description: 'OLD desc' }), embedding: fakeEmbedding(1) },
        ],
        ['UNCHANGED-1', { ...existingForUnchanged, embedding: fakeEmbedding(2) }],
      ]),
    );

    const freshEmbeddings = [fakeEmbedding(10), fakeEmbedding(11)];
    mockGenerateManyEmbeddings.mockResolvedValue(freshEmbeddings);

    await processValidItemsBatch({ jobId: 'job1', items, env: TEST_ENV });

    // generateManyEmbeddings called exactly once, with only 2 strings
    // (NEW-1 + CHANGED-1, NOT UNCHANGED-1).
    expect(mockGenerateManyEmbeddings).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateManyEmbeddings.mock.calls[0]?.[0] as { values: string[] };
    expect(callArgs.values).toHaveLength(2);
    expect(callArgs.values.some((v: string) => v.includes('NEW-1'))).toBe(true);
    expect(callArgs.values.some((v: string) => v.includes('CHANGED-1'))).toBe(true);
    expect(callArgs.values.some((v: string) => v.includes('UNCHANGED-1'))).toBe(false);

    // Upserted items: fresh partition gets the newly-generated embedding;
    // reuse partition gets embedding: undefined so the UPSERT's
    // COALESCE(excluded.embedding, catalog_items.embedding) preserves the
    // stored vector without a redundant write.
    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{
      sku: string;
      embedding: number[] | undefined;
    }>;
    expect(upserted.find((u) => u.sku === 'NEW-1')?.embedding).toEqual(freshEmbeddings[0]);
    expect(upserted.find((u) => u.sku === 'CHANGED-1')?.embedding).toEqual(freshEmbeddings[1]);
    expect(upserted.find((u) => u.sku === 'UNCHANGED-1')?.embedding).toBeUndefined();
  });

  it('skips generateManyEmbeddings entirely when every item is unchanged', async () => {
    const items = [makeItem('U1'), makeItem('U2')];

    mockFetchExistingForRegen.mockResolvedValue(
      new Map([
        ['U1', { ...makeItem('U1'), embedding: fakeEmbedding(1) }],
        ['U2', { ...makeItem('U2'), embedding: fakeEmbedding(2) }],
      ]),
    );

    await processValidItemsBatch({ jobId: 'jobNoCall', items, env: TEST_ENV });

    expect(mockGenerateManyEmbeddings).not.toHaveBeenCalled();

    // All items are reuse — UPSERT receives embedding: undefined, which
    // becomes NULL in the INSERT and triggers the COALESCE branch on
    // conflict, preserving the stored vector without a write.
    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{
      sku: string;
      embedding: number[] | undefined;
    }>;
    expect(upserted[0]?.embedding).toBeUndefined();
    expect(upserted[1]?.embedding).toBeUndefined();
  });

  it('treats an existing row with a null embedding as needing fresh generation', async () => {
    // Edge case: row was inserted but embedding column is NULL (failed prior
    // run, or pre-pipeline-fix data). Must regenerate even though source text
    // is identical.
    const items = [makeItem('NULL-EMB')];

    mockFetchExistingForRegen.mockResolvedValue(
      new Map([['NULL-EMB', { ...makeItem('NULL-EMB'), embedding: null }]]),
    );
    mockGenerateManyEmbeddings.mockResolvedValue([fakeEmbedding(42)]);

    await processValidItemsBatch({ jobId: 'jobNullEmb', items, env: TEST_ENV });

    expect(mockGenerateManyEmbeddings).toHaveBeenCalledTimes(1);
    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{
      embedding: number[];
    }>;
    expect(upserted[0]?.embedding).toEqual(fakeEmbedding(42));
  });

  it('handles the all-new partition (zero existing rows)', async () => {
    const items = [makeItem('N1'), makeItem('N2'), makeItem('N3')];

    mockFetchExistingForRegen.mockResolvedValue(new Map());
    mockGenerateManyEmbeddings.mockResolvedValue([
      fakeEmbedding(1),
      fakeEmbedding(2),
      fakeEmbedding(3),
    ]);

    await processValidItemsBatch({ jobId: 'jobAllNew', items, env: TEST_ENV });

    expect(mockGenerateManyEmbeddings).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateManyEmbeddings.mock.calls[0]?.[0] as { values: string[] };
    expect(callArgs.values).toHaveLength(3);

    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{ embedding: number[] }>;
    expect(upserted).toHaveLength(3);
    expect(upserted.every((u) => Array.isArray(u.embedding))).toBe(true);
  });

  it('throws → catch-block fallback path when generateManyEmbeddings returns short', async () => {
    // Defense against silent NULL embeddings if the embedding provider ever
    // returns fewer embeddings than inputs. The throw routes execution to the
    // surrounding try/catch which records the failure on
    // etl_jobs.total_embedding_failures and upserts the batch without
    // embeddings (degraded but consistent).
    const items = [makeItem('N1'), makeItem('N2'), makeItem('N3')];

    mockFetchExistingForRegen.mockResolvedValue(new Map());
    // Returns 2 embeddings for 3 fresh inputs — provider bug simulation.
    mockGenerateManyEmbeddings.mockResolvedValue([fakeEmbedding(1), fakeEmbedding(2)]);

    await processValidItemsBatch({ jobId: 'jobShortResp', items, env: TEST_ENV });

    // The throw should cause the catch-block fallback path to run, which
    // still upserts (without embeddings) — exactly once. The success path
    // and fallback path each upsert exactly once, so we expect 1 total call
    // (the catch block's upsert).
    expect(mockUpsertCatalogItems).toHaveBeenCalledTimes(1);

    // The fallback path passes mergedItems verbatim (no embedding key set),
    // so the upsert items don't carry the partial freshEmbeddings.
    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{
      sku: string;
      embedding?: number[];
    }>;
    expect(upserted).toHaveLength(3);
    // None of the fallback items should carry one of the partial fresh
    // embeddings — that would mean we silently shipped NULL on the third.
    expect(upserted.some((u) => u.embedding === fakeEmbedding(1))).toBe(false);
  });
});
