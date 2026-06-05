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
  createDbClient: vi.fn(() => ({
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  })),
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
  // biome-ignore lint/suspicious/noExplicitAny: test stub for the Env shape
} as any;

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

    // Upserted items received the right embeddings: fresh for NEW/CHANGED,
    // reused for UNCHANGED.
    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{
      sku: string;
      embedding: number[] | null;
    }>;
    expect(upserted.find((u) => u.sku === 'NEW-1')?.embedding).toEqual(freshEmbeddings[0]);
    expect(upserted.find((u) => u.sku === 'CHANGED-1')?.embedding).toEqual(freshEmbeddings[1]);
    expect(upserted.find((u) => u.sku === 'UNCHANGED-1')?.embedding).toEqual(fakeEmbedding(2));
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

    const upserted = mockUpsertCatalogItems.mock.calls[0]?.[0] as Array<{
      sku: string;
      embedding: number[];
    }>;
    expect(upserted[0]?.embedding).toEqual(fakeEmbedding(1));
    expect(upserted[1]?.embedding).toEqual(fakeEmbedding(2));
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
});
