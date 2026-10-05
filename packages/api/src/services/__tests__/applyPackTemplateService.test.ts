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
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
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
const args = { packId: 'p1', templateId: 't1', userId: 'u1', env };

describe('applyPackTemplate()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.packRows.length = 0;
  });

  it('rejects a pack the user does not own', async () => {
    mocks.packRows.push([]);
    await expect(applyPackTemplate(args)).resolves.toEqual({
      ok: false,
      reason: 'pack_not_found',
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
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
    expect(mocks.generateManyEmbeddings).not.toHaveBeenCalled();
  });

  it('copies every item in one embedding call and one insert', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({
      id: 't1',
      items: [templateItem('ti1', 'Tent'), templateItem('ti2', 'Stove')],
    });
    mocks.generateManyEmbeddings.mockResolvedValue([[0.1], [0.2]]);

    const result = await applyPackTemplate(args);

    expect(mocks.generateManyEmbeddings).toHaveBeenCalledTimes(1);
    expect(mocks.generateManyEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['Tent', 'Stove'] }),
    );
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    const [rows] = mocks.insertValues.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(rows.map((r) => [r.name, r.templateItemId, r.embedding, r.packId])).toEqual([
      ['Tent', 'ti1', [0.1], 'p1'],
      ['Stove', 'ti2', [0.2], 'p1'],
    ]);
    expect(mocks.updateSet).toHaveBeenCalledWith({ updatedAt: expect.any(Date) });

    if (!result.ok) throw new Error('expected ok');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).not.toHaveProperty('embedding');
    expect(result.items[0]).toMatchObject({ userId: 'u1', deleted: false, catalogItemId: 7 });
  });

  it('saves items without embeddings when the embedding call fails', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({ id: 't1', items: [templateItem('ti1', 'Tent')] });
    mocks.generateManyEmbeddings.mockRejectedValue(new Error('openai down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await applyPackTemplate(args);

    expect(result.ok).toBe(true);
    const [rows] = mocks.insertValues.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(rows[0]?.embedding).toBeNull();
  });

  it('drops misaligned embeddings rather than attach them to the wrong item', async () => {
    mocks.packRows.push([{ id: 'p1' }]);
    mocks.findFirst.mockResolvedValue({
      id: 't1',
      items: [templateItem('ti1', 'Tent'), templateItem('ti2', 'Stove')],
    });
    mocks.generateManyEmbeddings.mockResolvedValue([[0.1]]);

    await applyPackTemplate(args);

    const [rows] = mocks.insertValues.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(rows.map((r) => r.embedding)).toEqual([null, null]);
  });
});
