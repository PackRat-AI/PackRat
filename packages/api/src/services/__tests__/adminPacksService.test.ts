import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const updateResults: unknown[][] = [];
  const findFirst = vi.fn();
  const updateSet = vi.fn();
  const insertValues = vi.fn();
  // Every select chain resolves to the next queued result, however many
  // join/where/orderBy steps it takes to get there.
  const selectChain = () => {
    const chain = {
      from: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      // biome-ignore lint/suspicious/noThenProperty: the chain stands in for an awaitable Drizzle query
      then: (resolve: (rows: unknown[]) => unknown) => resolve(selectResults.shift() ?? []),
    };
    return chain;
  };
  const updateChain = (values: unknown) => {
    updateSet(values);
    const rows = updateResults.shift() ?? [];
    return {
      where: () => Object.assign(Promise.resolve(rows), { returning: () => Promise.resolve(rows) }),
    };
  };
  return {
    selectResults,
    updateResults,
    findFirst,
    updateSet,
    insertValues,
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: (_cols?: unknown) => selectChain(),
        query: { packs: { findFirst } },
        update: (_table: unknown) => ({ set: updateChain }),
        insert: (_table: unknown) => ({
          values: (values: unknown) => {
            insertValues(values);
            return Promise.resolve();
          },
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));

import {
  createAdminPackItem,
  deleteAdminPackItem,
  getAdminPack,
  updateAdminPack,
  updateAdminPackItem,
} from '../adminPacksService';

const packRow = {
  id: 'p1',
  name: 'Desert Overnighter',
  description: null,
  category: 'desert',
  image: null,
  tags: null,
  isPublic: false,
  isAIGenerated: true,
  ownerEmail: null,
  createdAt: new Date('2026-10-25T00:00:00Z'),
  updatedAt: new Date('2026-10-25T01:00:00Z'),
};

const itemRow = {
  id: 'i1',
  name: 'Tent',
  description: null,
  weight: 1,
  weightUnit: 'kg',
  quantity: 2,
  category: 'shelter',
  consumable: false,
  worn: false,
  image: null,
  notes: null,
  catalogItemId: 42,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResults.length = 0;
  mocks.updateResults.length = 0;
});

describe('getAdminPack', () => {
  it('returns null when the pack does not exist', async () => {
    mocks.selectResults.push([]);
    await expect(getAdminPack('missing')).resolves.toBeNull();
  });

  it('totals item weight in grams and serialises dates', async () => {
    mocks.selectResults.push([packRow], [itemRow, { ...itemRow, id: 'i2', weightUnit: 'bogus' }]);
    const pack = await getAdminPack('p1');
    expect(pack).toMatchObject({
      id: 'p1',
      tags: [],
      ownerEmail: null,
      itemCount: 2,
      // 1 kg × 2 + an unknown unit read as grams (1 g × 2)
      totalWeightGrams: 2002,
      createdAt: '2026-10-25T00:00:00.000Z',
      updatedAt: '2026-10-25T01:00:00.000Z',
    });
    expect(pack?.items.map((i) => i.id)).toEqual(['i1', 'i2']);
  });
});

describe('updateAdminPack', () => {
  it('returns null when no AI-generated pack matched', async () => {
    mocks.updateResults.push([]);
    await expect(updateAdminPack({ id: 'p1', changes: { isPublic: true } })).resolves.toBeNull();
  });

  it('applies the changes and returns the fresh detail', async () => {
    mocks.updateResults.push([{ id: 'p1' }]);
    mocks.selectResults.push([{ ...packRow, isPublic: true }], []);
    const pack = await updateAdminPack({ id: 'p1', changes: { isPublic: true } });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ isPublic: true }));
    expect(pack?.isPublic).toBe(true);
  });
});

describe('createAdminPackItem', () => {
  it('returns null when the pack is not editable', async () => {
    mocks.findFirst.mockResolvedValue(undefined);
    const result = await createAdminPackItem({
      packId: 'p1',
      item: { name: 'Tent', weight: 900, weightUnit: 'g' },
    });
    expect(result).toBeNull();
    expect(mocks.insertValues).toHaveBeenCalledTimes(0);
  });

  it("inserts the item under the pack's owner with defaults", async () => {
    mocks.findFirst.mockResolvedValue({ id: 'p1', userId: 'admin_1' });
    mocks.selectResults.push([itemRow]);
    const result = await createAdminPackItem({
      packId: 'p1',
      item: { name: 'Tent', weight: 900, weightUnit: 'g' },
    });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        packId: 'p1',
        userId: 'admin_1',
        name: 'Tent',
        quantity: 1,
        consumable: false,
        worn: false,
      }),
    );
    expect(result).toEqual(itemRow);
  });
});

describe('updateAdminPackItem', () => {
  it('returns null when the item is not in an AI-generated pack', async () => {
    mocks.selectResults.push([]);
    await expect(
      updateAdminPackItem({ itemId: 'i1', changes: { quantity: 3 } }),
    ).resolves.toBeNull();
    expect(mocks.updateSet).toHaveBeenCalledTimes(0);
  });

  it('updates the item and touches its pack', async () => {
    mocks.selectResults.push([{ packId: 'p1' }], [{ ...itemRow, quantity: 3 }]);
    const result = await updateAdminPackItem({ itemId: 'i1', changes: { quantity: 3 } });
    expect(mocks.updateSet).toHaveBeenNthCalledWith(1, expect.objectContaining({ quantity: 3 }));
    expect(mocks.updateSet).toHaveBeenCalledTimes(2);
    expect(result?.quantity).toBe(3);
  });
});

describe('deleteAdminPackItem', () => {
  it('returns false when the item is not editable', async () => {
    mocks.selectResults.push([]);
    await expect(deleteAdminPackItem('i1')).resolves.toBe(false);
  });

  it('soft-deletes the item', async () => {
    mocks.selectResults.push([{ packId: 'p1' }]);
    await expect(deleteAdminPackItem('i1')).resolves.toBe(true);
    expect(mocks.updateSet).toHaveBeenNthCalledWith(1, expect.objectContaining({ deleted: true }));
  });
});
