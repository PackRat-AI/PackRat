import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const insertReturning = vi.fn();
  const deleteReturning = vi.fn();
  return {
    findMany,
    insertReturning,
    deleteReturning,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        query: { featureFlags: { findMany } },
        insert: (_table: unknown) => ({
          values: (_values: unknown) => ({
            onConflictDoUpdate: (_opts: unknown) => ({
              returning: insertReturning,
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
vi.mock('@packrat/db', () => ({ featureFlags: { key: 'key' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col, val) => ({ col, val })) }));

import { APP_CONFIG, FeatureFlag } from '@packrat/config';
import {
  deleteFeatureFlagOverride,
  listEffectiveFeatureFlags,
  listFeatureFlagsForAdmin,
  upsertFeatureFlagOverride,
} from '../featureFlagsService';

describe('featureFlagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEffectiveFeatureFlags()', () => {
    it('returns the coded defaults when there are no overrides', async () => {
      mocks.findMany.mockResolvedValue([]);

      await expect(listEffectiveFeatureFlags()).resolves.toEqual(APP_CONFIG.featureFlags);
    });

    it('lets a DB override win over the coded default', async () => {
      const key = FeatureFlag.EnableFeed;
      const defaultValue = APP_CONFIG.featureFlags[key];
      mocks.findMany.mockResolvedValue([{ key, enabled: !defaultValue }]);

      const result = await listEffectiveFeatureFlags();
      expect(result[key]).toBe(!defaultValue);
    });

    it('ignores an override row for an unrecognized key', async () => {
      mocks.findMany.mockResolvedValue([{ key: 'totallyUnknownFlag', enabled: true }]);

      const result = await listEffectiveFeatureFlags();
      expect(result).toEqual(APP_CONFIG.featureFlags);
      expect('totallyUnknownFlag' in result).toBe(false);
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.findMany.mockRejectedValue(boom);

      await expect(listEffectiveFeatureFlags()).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureFlags.listEffective' }),
      );
    });
  });

  describe('listFeatureFlagsForAdmin()', () => {
    it('reports every known key as default (no override) when the table is empty', async () => {
      mocks.findMany.mockResolvedValue([]);

      const items = await listFeatureFlagsForAdmin();
      const feedItem = items.find((item) => item.key === FeatureFlag.EnableFeed);
      expect(feedItem).toEqual({
        key: FeatureFlag.EnableFeed,
        defaultValue: APP_CONFIG.featureFlags[FeatureFlag.EnableFeed],
        override: null,
        effective: APP_CONFIG.featureFlags[FeatureFlag.EnableFeed],
        description: null,
        updatedAt: null,
      });
    });

    it('merges an override row onto its matching key', async () => {
      const updatedAt = new Date('2026-01-01T00:00:00.000Z');
      mocks.findMany.mockResolvedValue([
        {
          key: FeatureFlag.EnableTrips,
          enabled: false,
          description: 'killed for launch',
          updatedAt,
        },
      ]);

      const items = await listFeatureFlagsForAdmin();
      const tripsItem = items.find((item) => item.key === FeatureFlag.EnableTrips);
      expect(tripsItem).toEqual({
        key: FeatureFlag.EnableTrips,
        defaultValue: APP_CONFIG.featureFlags[FeatureFlag.EnableTrips],
        override: false,
        effective: false,
        description: 'killed for launch',
        updatedAt,
      });
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.findMany.mockRejectedValue(boom);

      await expect(listFeatureFlagsForAdmin()).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureFlags.listAdmin' }),
      );
    });
  });

  describe('upsertFeatureFlagOverride()', () => {
    it('returns the upserted row shaped as an AdminFeatureFlagItem', async () => {
      const updatedAt = new Date('2026-02-01T00:00:00.000Z');
      mocks.insertReturning.mockResolvedValue([
        { key: FeatureFlag.EnableFeed, enabled: true, description: 'launch push', updatedAt },
      ]);

      await expect(
        upsertFeatureFlagOverride({
          key: FeatureFlag.EnableFeed,
          enabled: true,
          description: 'launch push',
        }),
      ).resolves.toEqual({
        key: FeatureFlag.EnableFeed,
        defaultValue: APP_CONFIG.featureFlags[FeatureFlag.EnableFeed],
        override: true,
        effective: true,
        description: 'launch push',
        updatedAt,
      });
    });

    it('captures and rethrows when the insert returns no row', async () => {
      mocks.insertReturning.mockResolvedValue([]);

      await expect(
        upsertFeatureFlagOverride({ key: FeatureFlag.EnableFeed, enabled: true }),
      ).rejects.toThrow('Failed to upsert feature flag override');
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'featureFlags.upsert' }),
      );
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.insertReturning.mockRejectedValue(boom);

      await expect(
        upsertFeatureFlagOverride({ key: FeatureFlag.EnableFeed, enabled: true }),
      ).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureFlags.upsert' }),
      );
    });
  });

  describe('deleteFeatureFlagOverride()', () => {
    it('returns true when a row was deleted', async () => {
      mocks.deleteReturning.mockResolvedValue([{ key: FeatureFlag.EnableFeed }]);

      await expect(deleteFeatureFlagOverride(FeatureFlag.EnableFeed)).resolves.toBe(true);
    });

    it('returns false when no override existed', async () => {
      mocks.deleteReturning.mockResolvedValue([]);

      await expect(deleteFeatureFlagOverride(FeatureFlag.EnableFeed)).resolves.toBe(false);
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.deleteReturning.mockRejectedValue(boom);

      await expect(deleteFeatureFlagOverride(FeatureFlag.EnableFeed)).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({ error: boom, operation: 'featureFlags.delete' }),
      );
    });
  });
});
