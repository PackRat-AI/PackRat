import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  const insertReturning = vi.fn();
  const updateReturning = vi.fn();
  const deleteReturning = vi.fn();
  return {
    findMany,
    findFirst,
    insertReturning,
    updateReturning,
    deleteReturning,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        query: { featureAccess: { findMany, findFirst } },
        insert: (_table: unknown) => ({
          values: (_values: unknown) => ({
            returning: insertReturning,
          }),
        }),
        update: (_table: unknown) => ({
          set: (_values: unknown) => ({
            where: (_cond: unknown) => ({
              returning: updateReturning,
            }),
          }),
        }),
        delete: (_table: unknown) => ({
          where: (_cond: unknown) => ({
            returning: deleteReturning,
          }),
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/db', () => ({ featureAccess: { key: 'key' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col, val) => ({ col, val })) }));

import {
  canAccessFeature,
  createFeatureAccess,
  deleteFeatureAccess,
  listFeatureAccess,
  listFeatureAccessForAdmin,
  updateFeatureAccess,
} from '../featureAccessService';

const HOUR = 60 * 60 * 1000;

describe('featureAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFeatureAccess()', () => {
    it('returns the projected config rows', async () => {
      const rows = [{ key: 'wildlife_id', label: 'Wildlife ID', earlyAccessUntil: null }];
      mocks.findMany.mockResolvedValue(rows);

      await expect(listFeatureAccess()).resolves.toEqual(rows);
      expect(mocks.findMany).toHaveBeenCalledWith({
        columns: { key: true, label: true, description: true, earlyAccessUntil: true },
      });
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.findMany.mockRejectedValue(boom);

      await expect(listFeatureAccess()).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureAccess.list' }),
      );
    });
  });

  describe('canAccessFeature()', () => {
    it('gates an in-window feature to Pro members', async () => {
      mocks.findFirst.mockResolvedValue({ earlyAccessUntil: new Date(Date.now() + HOUR) });

      await expect(canAccessFeature('feed', false)).resolves.toBe(false);
      await expect(canAccessFeature('feed', true)).resolves.toBe(true);
    });

    it('allows everyone once the feature has graduated', async () => {
      mocks.findFirst.mockResolvedValue({ earlyAccessUntil: new Date(Date.now() - HOUR) });

      await expect(canAccessFeature('feed', false)).resolves.toBe(true);
    });

    it('allows a feature that has no config row (never gated)', async () => {
      mocks.findFirst.mockResolvedValue(undefined);

      await expect(canAccessFeature('packs', false)).resolves.toBe(true);
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.findFirst.mockRejectedValue(boom);

      await expect(canAccessFeature('feed', true)).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureAccess.canAccess' }),
      );
    });
  });

  describe('listFeatureAccessForAdmin()', () => {
    it('returns the full rows', async () => {
      const rows = [
        {
          key: 'wildlife_id',
          label: 'Wildlife ID',
          earlyAccessUntil: null,
          releasedAt: new Date(),
        },
      ];
      mocks.findMany.mockResolvedValue(rows);

      await expect(listFeatureAccessForAdmin()).resolves.toEqual(rows);
      expect(mocks.findMany).toHaveBeenCalledWith();
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.findMany.mockRejectedValue(boom);

      await expect(listFeatureAccessForAdmin()).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureAccess.listAdmin' }),
      );
    });
  });

  describe('createFeatureAccess()', () => {
    it('returns the created row', async () => {
      const row = { key: 'feed', label: 'Feed', earlyAccessUntil: null };
      mocks.insertReturning.mockResolvedValue([row]);

      await expect(createFeatureAccess({ key: 'feed', label: 'Feed' })).resolves.toEqual(row);
    });

    it('captures and rethrows when no row comes back', async () => {
      mocks.insertReturning.mockResolvedValue([]);

      await expect(createFeatureAccess({ key: 'feed', label: 'Feed' })).rejects.toThrow(
        'Failed to create feature-access row',
      );
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'featureAccess.create' }),
      );
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.insertReturning.mockRejectedValue(boom);

      await expect(createFeatureAccess({ key: 'feed', label: 'Feed' })).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureAccess.create' }),
      );
    });

    it('passes through a description when provided', async () => {
      const row = { key: 'feed', label: 'Feed', description: 'Catch up on the trail.' };
      mocks.insertReturning.mockResolvedValue([row]);

      await expect(
        createFeatureAccess({ key: 'feed', label: 'Feed', description: 'Catch up on the trail.' }),
      ).resolves.toEqual(row);
    });
  });

  describe('updateFeatureAccess()', () => {
    it('returns the updated row', async () => {
      const row = { key: 'feed', label: 'New label', earlyAccessUntil: null };
      mocks.updateReturning.mockResolvedValue([row]);

      await expect(updateFeatureAccess('feed', { label: 'New label' })).resolves.toEqual(row);
    });

    it('returns null when no row matches the key', async () => {
      mocks.updateReturning.mockResolvedValue([]);

      await expect(updateFeatureAccess('missing', { label: 'x' })).resolves.toBeNull();
    });

    it('accepts a description update, including clearing it with null', async () => {
      const row = { key: 'feed', label: 'Feed', description: null };
      mocks.updateReturning.mockResolvedValue([row]);

      await expect(updateFeatureAccess('feed', { description: null })).resolves.toEqual(row);
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.updateReturning.mockRejectedValue(boom);

      await expect(updateFeatureAccess('feed', { label: 'x' })).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureAccess.update' }),
      );
    });
  });

  describe('deleteFeatureAccess()', () => {
    it('returns true when a row was deleted', async () => {
      mocks.deleteReturning.mockResolvedValue([{ key: 'feed' }]);

      await expect(deleteFeatureAccess('feed')).resolves.toBe(true);
    });

    it('returns false when no row matched', async () => {
      mocks.deleteReturning.mockResolvedValue([]);

      await expect(deleteFeatureAccess('missing')).resolves.toBe(false);
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.deleteReturning.mockRejectedValue(boom);

      await expect(deleteFeatureAccess('feed')).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureAccess.delete' }),
      );
    });
  });
});
