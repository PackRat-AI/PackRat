import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  return {
    findMany,
    findFirst,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (_label: string) => db,
        query: { featureAccess: { findMany, findFirst } },
      };
      return db;
    }),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('@packrat/db', () => ({ featureAccess: { key: 'key' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col, val) => ({ col, val })) }));

import { canAccessFeature, listFeatureAccess } from '../featureAccessService';

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
        columns: { key: true, label: true, earlyAccessUntil: true },
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
});
