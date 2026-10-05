import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const findFirst = vi.fn();
  const updateReturning = vi.fn();
  const updateSet = vi.fn((_values: unknown) => ({
    where: (_cond: unknown) => ({ returning: updateReturning }),
  }));
  // Each select chain resolves to the next queued result, whether awaited
  // straight after `.where()` (items) or after `.orderBy()` (templates).
  const chain = () => ({
    from: () => ({
      where: () => {
        const rows = selectResults.shift() ?? [];
        return Object.assign(Promise.resolve(rows), { orderBy: () => Promise.resolve(rows) });
      },
    }),
  });
  return {
    selectResults,
    findFirst,
    updateReturning,
    updateSet,
    resolveOwner: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        select: (_cols?: unknown) => chain(),
        query: { packTemplates: { findFirst } },
        update: (_table: unknown) => ({ set: updateSet }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/services/packTemplateImportService', () => ({
  resolveAppTemplateOwnerId: mocks.resolveOwner,
}));
vi.mock('@packrat/db/schema', () => ({
  packTemplates: { id: 'id', deleted: 'deleted', isAppTemplate: 'isApp', userId: 'userId' },
  packTemplateItems: { id: 'iid', packTemplateId: 'ptid', deleted: 'ideleted' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ and: args })),
  desc: vi.fn((c) => ({ desc: c })),
  eq: vi.fn((col, val) => ({ eq: [col, val] })),
  inArray: vi.fn((col, vals) => ({ inArray: [col, vals] })),
  isNotNull: vi.fn((c) => ({ isNotNull: c })),
  or: vi.fn((...args) => ({ or: args })),
}));

import {
  deleteCuratedPackTemplate,
  deleteCuratedPackTemplateItem,
  getCuratedPackTemplate,
  listCuratedPackTemplates,
  updateCuratedPackTemplate,
  updateCuratedPackTemplateItem,
} from '../adminPackTemplatesService';

const created = new Date('2026-10-01T00:00:00Z');
const template = {
  id: 'pt_1',
  name: 'Winter Day Hike',
  description: null,
  category: 'winter',
  userId: 'admin_1',
  image: null,
  tags: null,
  isAppTemplate: false,
  deleted: false,
  contentSource: 'tiktok',
  contentId: '123',
  localCreatedAt: created,
  localUpdatedAt: created,
  createdAt: created,
  updatedAt: created,
};
const item = {
  id: 'pti_1',
  name: 'Puffy',
  description: null,
  weight: 1,
  weightUnit: 'kg',
  quantity: 2,
  category: 'clothing',
  consumable: false,
  worn: false,
  image: null,
  notes: null,
  packTemplateId: 'pt_1',
  catalogItemId: null,
  userId: 'admin_1',
  deleted: false,
  createdAt: created,
  updatedAt: created,
};

describe('adminPackTemplatesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults.length = 0;
    mocks.resolveOwner.mockResolvedValue('admin_1');
  });

  describe('listCuratedPackTemplates()', () => {
    it('returns an empty list without querying items when nothing is curated', async () => {
      mocks.selectResults.push([]);
      await expect(listCuratedPackTemplates()).resolves.toEqual([]);
      expect(mocks.selectResults).toHaveLength(0);
    });

    it('summarises item count and total weight in grams per template', async () => {
      mocks.selectResults.push(
        [template],
        [
          { packTemplateId: 'pt_1', weight: 1, weightUnit: 'kg', quantity: 2 },
          { packTemplateId: 'pt_1', weight: 100, weightUnit: 'not-a-unit', quantity: 1 },
          { packTemplateId: 'other', weight: 5, weightUnit: 'kg', quantity: 1 },
        ],
      );
      const [summary] = await listCuratedPackTemplates();
      expect(summary).toMatchObject({
        id: 'pt_1',
        tags: [],
        itemCount: 2,
        totalWeightGrams: 2100,
        createdAt: created.toISOString(),
      });
    });

    it('falls back to published-only when no admin owner exists', async () => {
      mocks.resolveOwner.mockResolvedValue(null);
      mocks.selectResults.push([]);
      await listCuratedPackTemplates();
      const { or } = await import('drizzle-orm');
      expect(or).toHaveBeenCalledTimes(0);
    });
  });

  describe('getCuratedPackTemplate()', () => {
    it('returns null for a missing template', async () => {
      mocks.findFirst.mockResolvedValue(undefined);
      await expect(getCuratedPackTemplate('nope')).resolves.toBeNull();
    });

    it('returns the summary plus mapped items', async () => {
      mocks.findFirst.mockResolvedValue({ ...template, items: [item] });
      const detail = await getCuratedPackTemplate('pt_1');
      expect(detail?.totalWeightGrams).toBe(2000);
      expect(detail?.items).toEqual([
        expect.objectContaining({ id: 'pti_1', weight: 1, weightUnit: 'kg', quantity: 2 }),
      ]);
      expect(detail?.items[0]).not.toHaveProperty('userId');
    });
  });

  describe('updateCuratedPackTemplate()', () => {
    it('returns null when no row was updated', async () => {
      mocks.updateReturning.mockResolvedValue([]);
      await expect(
        updateCuratedPackTemplate({ id: 'pt_1', changes: { isAppTemplate: true } }),
      ).resolves.toBeNull();
    });

    it('applies the changes and returns the fresh detail', async () => {
      mocks.updateReturning.mockResolvedValue([template]);
      mocks.findFirst.mockResolvedValue({ ...template, isAppTemplate: true, items: [] });
      const detail = await updateCuratedPackTemplate({
        id: 'pt_1',
        changes: { isAppTemplate: true },
      });
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isAppTemplate: true, updatedAt: expect.any(Date) }),
      );
      expect(detail?.isAppTemplate).toBe(true);
    });
  });

  describe('deleteCuratedPackTemplate()', () => {
    it('soft-deletes and unpublishes', async () => {
      mocks.updateReturning.mockResolvedValue([template]);
      await expect(deleteCuratedPackTemplate('pt_1')).resolves.toBe(true);
      expect(mocks.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: true, isAppTemplate: false }),
      );
    });

    it('reports false when nothing matched', async () => {
      mocks.updateReturning.mockResolvedValue([]);
      await expect(deleteCuratedPackTemplate('nope')).resolves.toBe(false);
    });
  });

  describe('items', () => {
    it('updates an item and returns its admin shape', async () => {
      mocks.updateReturning.mockResolvedValue([{ ...item, name: 'Down Puffy' }]);
      const updated = await updateCuratedPackTemplateItem({
        itemId: 'pti_1',
        changes: { name: 'Down Puffy' },
      });
      expect(updated).toMatchObject({ id: 'pti_1', name: 'Down Puffy' });
    });

    it('returns null when the item is missing', async () => {
      mocks.updateReturning.mockResolvedValue([]);
      await expect(
        updateCuratedPackTemplateItem({ itemId: 'nope', changes: { quantity: 1 } }),
      ).resolves.toBeNull();
    });

    it('soft-deletes an item', async () => {
      mocks.updateReturning.mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
      await expect(deleteCuratedPackTemplateItem('pti_1')).resolves.toBe(true);
      await expect(deleteCuratedPackTemplateItem('pti_1')).resolves.toBe(false);
      expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ deleted: true }));
    });
  });
});
