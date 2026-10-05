import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const packRows: unknown[][] = [];
  const findFirst = vi.fn();
  const insertValues = vi.fn();
  const updateSet = vi.fn(() => ({ where: vi.fn() }));
  const tx = {
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: updateSet })),
  };
  return {
    packRows,
    findFirst,
    insertValues,
    updateSet,
    tx,
    generateManyEmbeddings: vi.fn(),
    captureApiException: vi.fn(),
    embeddingSet: vi.fn((_values: unknown) => ({ where: vi.fn(() => Promise.resolve()) })),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(packRows.shift() ?? []) }),
          }),
        }),
        query: { packTemplates: { findFirst } },
        transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
        // Only the post-response embedding backfill updates through `db`.
        update: () => ({ set: mocks.embeddingSet }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/api/services/embeddingService', () => ({
  generateManyEmbeddings: mocks.generateManyEmbeddings,
}));
vi.mock('@packrat/api/utils/embeddingHelper', () => ({
  getEmbeddingText: ({ item }: { item: { name: string } }) => item.name,
}));
vi.mock('@packrat/db/schema', () => ({
  packItems: {},
  packs: { id: 'id', userId: 'userId', deleted: 'deleted' },
  packTemplates: { id: 'id', deleted: 'deleted', userId: 'userId', isAppTemplate: 'isApp' },
  packTemplateItems: { deleted: 'deleted' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ and: args })),
  eq: vi.fn((col, val) => ({ eq: [col, val] })),
  or: vi.fn((...args) => ({ or: args })),
}));

import { applyPackTemplate } from '../applyPackTemplateService';

const env = { OPENAI_API_KEY: 'k' } as Parameters<typeof applyPackTemplate>[0]['env'];
const templateItem = (id: string, name: string) => ({
  id,
  name,
  description: null,
  weight: 500,
  weightUnit: 'g',
  quantity: 1,
  category: 'shelter',
  consumable: false,
  worn: false,
  image: null,
  notes: null,
  catalogItemId: 7,
});
// Collects the deferred task instead of handing it to waitUntil, so a test can
// assert on what happens before the response and run the backfill explicitly.
let deferred: Array<() => Promise<void>> = [];
const defer = async (task: () => Promise<void>) => {
  deferred.push(task);
};
const runDeferred = async () => {
  for (const task of deferred) await task();
};
const args = { packId: 'p1', templateId: 't1', userId: 'u1', env, defer };

describe('applyPackTemplate()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.packRows.length = 0;
    deferred = [];
  });

  it('rejects a pack the user does not own', async () => {
    mocks.packRows.push([]);
    await expect(applyPackTemplate(args)).resolves.toEqual({
      ok: false,
      reason: 'pack_not_found',
    });
    expect(mocks.findFirst).toHaveBeenCalledTimes(0);
  });

  it('rejects a template the user cannot see', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue(undefined);
    await expect(applyPackTemplate(args)).resolves.toEqual({
      ok: false,
      reason: 'template_not_found',
    });
  });

  it('is a no-op for a template with no active items', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({ id: 't1', items: [] });
    await expect(applyPackTemplate(args)).resolves.toEqual({ ok: true, items: [] });
    expect(mocks.generateManyEmbeddings).toHaveBeenCalledTimes(0);
  });

  it('inserts every item at once and returns before any embedding work', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({
      id: 't1',
      items: [templateItem('ti1', 'Tent'), templateItem('ti2', 'Stove')],
    });

    const result = await applyPackTemplate(args);

    expect(mocks.generateManyEmbeddings).toHaveBeenCalledTimes(0);
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    const [rows] = mocks.insertValues.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(rows.map((r) => [r.name, r.templateItemId, r.embedding, r.packId])).toEqual([
      ['Tent', 'ti1', null, 'p1'],
      ['Stove', 'ti2', null, 'p1'],
    ]);
    expect(mocks.updateSet).toHaveBeenCalledWith({ updatedAt: expect.any(Date) });
    expect(deferred).toHaveLength(1);

    if (!result.ok) throw new Error('expected ok');
    expect(result.items.map((i) => i.name)).toEqual(['Tent', 'Stove']);
    expect(result.items[0]).not.toHaveProperty('embedding');
    expect(result.items[0]).toMatchObject({ userId: 'u1', deleted: false, catalogItemId: 7 });
  });

  it('backfills embeddings in one batch call after the response', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({
      id: 't1',
      items: [templateItem('ti1', 'Tent'), templateItem('ti2', 'Stove')],
    });
    mocks.generateManyEmbeddings.mockResolvedValue([[0.1], [0.2]]);

    await applyPackTemplate(args);
    await runDeferred();

    expect(mocks.generateManyEmbeddings).toHaveBeenCalledTimes(1);
    expect(mocks.generateManyEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['Tent', 'Stove'] }),
    );
    expect(mocks.embeddingSet.mock.calls.map(([v]) => v)).toEqual([
      { embedding: [0.1] },
      { embedding: [0.2] },
    ]);
  });

  it('leaves items unembedded when the embedding call fails', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({ id: 't1', items: [templateItem('ti1', 'Tent')] });
    mocks.generateManyEmbeddings.mockRejectedValue(new Error('openai down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await applyPackTemplate(args);
    await runDeferred();

    expect(result.ok).toBe(true);
    expect(mocks.embeddingSet).toHaveBeenCalledTimes(0);
  });

  it('drops misaligned embeddings rather than attach them to the wrong item', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({
      id: 't1',
      items: [templateItem('ti1', 'Tent'), templateItem('ti2', 'Stove')],
    });
    mocks.generateManyEmbeddings.mockResolvedValue([[0.1]]);

    await applyPackTemplate(args);
    await runDeferred();

    expect(mocks.embeddingSet).toHaveBeenCalledTimes(0);
  });

  it('reports, and swallows, a failed backfill write', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({ id: 't1', items: [templateItem('ti1', 'Tent')] });
    mocks.generateManyEmbeddings.mockResolvedValue([[0.1]]);
    const boom = new Error('neon down');
    mocks.embeddingSet.mockImplementationOnce(() => ({ where: vi.fn(() => Promise.reject(boom)) }));

    await applyPackTemplate(args);
    await expect(runDeferred()).resolves.toBeUndefined();

    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ error: boom, operation: 'packs.applyTemplate.backfillEmbeddings' }),
    );
  });

  it('runs the backfill inline when there is no workerd request context', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({ id: 't1', items: [templateItem('ti1', 'Tent')] });
    mocks.generateManyEmbeddings.mockResolvedValue([[0.3]]);
    const { defer: _ignored, ...withoutDefer } = args;

    await applyPackTemplate(withoutDefer);

    expect(mocks.embeddingSet).toHaveBeenCalledWith({ embedding: [0.3] });
  });
});
