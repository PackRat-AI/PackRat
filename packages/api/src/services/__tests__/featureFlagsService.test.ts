import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const platformFindMany = vi.fn();
  const insertReturning = vi.fn();
  const deleteReturning = vi.fn();
  // Platform-override writes are fire-and-forget — no `.returning()` — so the
  // awaited value is the builder itself. These spies record what each stage was
  // handed so the tests can assert on the shape of the write.
  const tags = vi.fn();
  const insertValues = vi.fn();
  const onConflictDoNothing = vi.fn();
  const onConflictDoUpdate = vi.fn();
  const deleteWhere = vi.fn();
  return {
    findMany,
    platformFindMany,
    insertReturning,
    deleteReturning,
    tags,
    insertValues,
    onConflictDoNothing,
    onConflictDoUpdate,
    deleteWhere,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (label: string) => {
          tags(label);
          return db;
        },
        query: {
          featureFlags: { findMany },
          featureFlagPlatformOverrides: { findMany: platformFindMany },
        },
        insert: (_table: unknown) => ({
          values: (values: unknown) => {
            insertValues(values);
            return {
              onConflictDoUpdate: (opts: unknown) => {
                onConflictDoUpdate(opts);
                return { returning: insertReturning };
              },
              onConflictDoNothing: (opts: unknown) => {
                onConflictDoNothing(opts);
                return undefined;
              },
            };
          },
        }),
        delete: (_table: unknown) => ({
          where: (cond: unknown) => {
            deleteWhere(cond);
            return { returning: deleteReturning };
          },
        }),
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/db', () => ({
  featureFlags: { key: 'key' },
  featureFlagPlatformOverrides: { key: 'key', platform: 'platform' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conds) => ({ conds })),
  eq: vi.fn((col, val) => ({ col, val })),
  relations: vi.fn(() => ({})),
}));

import { APP_CONFIG, FeatureFlag } from '@packrat/config';
import {
  deleteFeatureFlagOverride,
  listEffectiveFeatureFlags,
  listFeatureFlagsForAdmin,
  setFeatureFlagPlatformOverride,
  upsertFeatureFlagOverride,
} from '../featureFlagsService';

describe('featureFlagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Most cases have no platform overrides; the ones that do set their own.
    mocks.platformFindMany.mockResolvedValue([]);
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
        platformOverrides: {},
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
        platformOverrides: {},
      });
    });

    it('attaches platform overrides to the flag they belong to', async () => {
      const updatedAt = new Date('2026-03-01T00:00:00.000Z');
      mocks.findMany.mockResolvedValue([]);
      mocks.platformFindMany.mockResolvedValue([
        {
          key: FeatureFlag.EnableTrips,
          platform: 'macos',
          enabled: false,
          reason: 'desktop layout unfinished',
          updatedAt,
        },
      ]);

      const items = await listFeatureFlagsForAdmin();

      expect(items.find((item) => item.key === FeatureFlag.EnableTrips)?.platformOverrides).toEqual(
        {
          macos: { enabled: false, reason: 'desktop layout unfinished', updatedAt },
        },
      );
      // A row for one flag must not leak onto its neighbours.
      expect(items.find((item) => item.key === FeatureFlag.EnableFeed)?.platformOverrides).toEqual(
        {},
      );
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
        // A global write does not touch platform rows; the caller refetches
        // the list to see them.
        platformOverrides: {},
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

  // Platform targeting (#2736) shipped without coverage: the platform branch of
  // `listEffectiveFeatureFlags` and all of `setFeatureFlagPlatformOverride` were
  // unreached, which is what dropped packages/api below its ratchet baseline.
  describe('listEffectiveFeatureFlags() platform targeting', () => {
    it('a platform override wins over the global value', async () => {
      mocks.findMany.mockResolvedValue([{ key: FeatureFlag.EnableFeed, enabled: false }]);
      mocks.platformFindMany.mockResolvedValue([{ key: FeatureFlag.EnableFeed, enabled: true }]);

      const result = await listEffectiveFeatureFlags('ios');

      expect(result[FeatureFlag.EnableFeed]).toBe(true);
    });

    it('flags the platform says nothing about keep the global value', async () => {
      mocks.findMany.mockResolvedValue([{ key: FeatureFlag.EnableFeed, enabled: true }]);
      mocks.platformFindMany.mockResolvedValue([]);

      const result = await listEffectiveFeatureFlags('ios');

      expect(result[FeatureFlag.EnableFeed]).toBe(true);
    });

    it('does not query platform rows for an unrecognised platform', async () => {
      mocks.findMany.mockResolvedValue([]);

      // An old client or an untargeted surface must fall back to global flags
      // rather than having everything dark-launched, so the query is skipped
      // entirely rather than run with a value the schema cannot match.
      await expect(listEffectiveFeatureFlags('blackberry')).resolves.toEqual(
        APP_CONFIG.featureFlags,
      );
      expect(mocks.platformFindMany).not.toHaveBeenCalled();
    });

    it('does not query platform rows when no platform is given', async () => {
      mocks.findMany.mockResolvedValue([]);

      await listEffectiveFeatureFlags();

      expect(mocks.platformFindMany).not.toHaveBeenCalled();
    });
  });

  describe('setFeatureFlagPlatformOverride()', () => {
    it('seeds the global row before writing the platform override', async () => {
      await setFeatureFlagPlatformOverride({
        key: FeatureFlag.EnableFeed,
        platform: 'ios',
        enabled: true,
      });

      // The platform table references feature_flags, so the global row has to
      // exist first — and it is seeded at the coded default, because targeting
      // one platform says nothing about the others. Seeding must not clobber an
      // existing global value, hence DO NOTHING keyed on the flag.
      expect(mocks.onConflictDoNothing).toHaveBeenCalledWith(
        expect.objectContaining({ target: expect.anything() }),
      );
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          key: FeatureFlag.EnableFeed,
          enabled: APP_CONFIG.featureFlags[FeatureFlag.EnableFeed],
        }),
      );
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: FeatureFlag.EnableFeed, platform: 'ios', enabled: true }),
      );
    });

    it('upserts so re-targeting the same platform updates in place', async () => {
      await setFeatureFlagPlatformOverride({
        key: FeatureFlag.EnableFeed,
        platform: 'android',
        enabled: false,
        reason: 'crash on 14',
      });

      // Conflict is on the (key, platform) pair, and the update carries the new
      // value through — otherwise re-targeting a platform would insert a second
      // row or silently keep the old value.
      expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.arrayContaining([expect.anything(), expect.anything()]),
          set: expect.objectContaining({ enabled: false, reason: 'crash on 14' }),
        }),
      );
      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'android', enabled: false, reason: 'crash on 14' }),
      );
    });

    it('a null enabled deletes the row so the platform inherits again', async () => {
      await setFeatureFlagPlatformOverride({
        key: FeatureFlag.EnableFeed,
        platform: 'ios',
        enabled: null,
      });

      // Clearing is a delete, not a stored "inherit" value — an absent row is
      // how inheritance is already expressed, and a third state would be a
      // second way to say the same thing. The delete is scoped to both columns
      // so clearing one platform cannot wipe another's override.
      expect(mocks.deleteWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          conds: expect.arrayContaining([
            expect.objectContaining({ val: FeatureFlag.EnableFeed }),
            expect.objectContaining({ val: 'ios' }),
          ]),
        }),
      );
      expect(mocks.insertValues).not.toHaveBeenCalled();
    });

    it('omits a missing reason rather than writing undefined', async () => {
      await setFeatureFlagPlatformOverride({
        key: FeatureFlag.EnableFeed,
        platform: 'ios',
        enabled: true,
      });

      expect(mocks.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'ios', reason: null }),
      );
    });

    it('captures and rethrows on a DB error', async () => {
      const boom = new Error('db down');
      mocks.onConflictDoNothing.mockImplementationOnce(() => {
        throw boom;
      });

      await expect(
        setFeatureFlagPlatformOverride({
          key: FeatureFlag.EnableFeed,
          platform: 'ios',
          enabled: true,
        }),
      ).rejects.toBe(boom);
      expect(mocks.captureApiException).toHaveBeenCalledWith(
        expect.objectContaining({
          error: boom,
          operation: 'featureFlags.setPlatformOverride',
        }),
      );
    });
  });
});
