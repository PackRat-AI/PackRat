import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tags = vi.fn();
  const selectWhere = vi.fn();
  const insertValues = vi.fn();
  const onConflictDoUpdate = vi.fn();
  const insertReturning = vi.fn();
  const deleteWhere = vi.fn();
  const deleteReturning = vi.fn();
  return {
    tags,
    selectWhere,
    insertValues,
    onConflictDoUpdate,
    insertReturning,
    deleteWhere,
    deleteReturning,
    captureApiException: vi.fn(),
    createDb: vi.fn(() => {
      const db = {
        tag: (label: string) => {
          tags(label);
          return db;
        },
        select: (_cols: unknown) => ({
          from: (_table: unknown) => ({ where: selectWhere }),
        }),
        insert: (_table: unknown) => ({
          values: (values: unknown) => {
            insertValues(values);
            return {
              onConflictDoUpdate: (opts: unknown) => {
                onConflictDoUpdate(opts);
                return { returning: insertReturning };
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
vi.mock('@packrat/db/schema', () => ({
  weatherWatchedLocations: {
    id: 'id',
    userId: 'userId',
    weatherLocationId: 'weatherLocationId',
    locationName: 'locationName',
    region: 'region',
    country: 'country',
    lat: 'lat',
    lon: 'lon',
    createdAt: 'createdAt',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conds) => ({ and: conds })),
  eq: vi.fn((col, val) => ({ col, val })),
}));

import {
  addWatchedLocation,
  listWatchedLocations,
  removeWatchedLocation,
} from '../watchListService';

const request = {
  weatherLocationId: 42,
  locationName: 'Boulder',
  region: 'Colorado',
  country: 'USA',
  lat: 40.01,
  lon: -105.27,
};

const storedRow = { id: 'watch-1', ...request, createdAt: new Date('2026-01-01') };

describe('listWatchedLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectWhere.mockResolvedValue([storedRow]);
  });

  it("returns the caller's watched locations", async () => {
    const result = await listWatchedLocations('user-1');

    expect(result).toEqual([storedRow]);
  });

  it('scopes the query to the calling user', async () => {
    await listWatchedLocations('user-1');

    expect(mocks.selectWhere).toHaveBeenCalledWith({ col: 'userId', val: 'user-1' });
  });

  it('returns an empty list when nothing is watched', async () => {
    mocks.selectWhere.mockResolvedValue([]);

    expect(await listWatchedLocations('user-1')).toEqual([]);
  });

  it('reports a read failure to Sentry, then rethrows', async () => {
    const failure = new Error('connection reset');
    mocks.selectWhere.mockRejectedValue(failure);

    await expect(listWatchedLocations('user-1')).rejects.toThrow('connection reset');
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failure,
        operation: 'weatherMonitoring.listWatchedLocations',
        userId: 'user-1',
      }),
    );
  });
});

describe('addWatchedLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertReturning.mockResolvedValue([storedRow]);
  });

  it('returns the stored row', async () => {
    expect(await addWatchedLocation({ userId: 'user-1', request })).toEqual(storedRow);
  });

  it('stores the location against the calling user', async () => {
    await addWatchedLocation({ userId: 'user-1', request });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        weatherLocationId: 42,
        locationName: 'Boulder',
        region: 'Colorado',
        country: 'USA',
        lat: 40.01,
        lon: -105.27,
      }),
    );
  });

  it('defaults an absent region and country to null rather than undefined', async () => {
    await addWatchedLocation({
      userId: 'user-1',
      request: { ...request, region: undefined, country: undefined },
    });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ region: null, country: null }),
    );
  });

  it('is idempotent on (user, location) so re-adding returns the existing row', async () => {
    await addWatchedLocation({ userId: 'user-1', request });

    const opts = mocks.onConflictDoUpdate.mock.calls[0]?.[0] as {
      target: unknown[];
      set: { updatedAt: Date };
    };
    expect(opts.target).toEqual(['userId', 'weatherLocationId']);
    expect(opts.set.updatedAt).toBeInstanceOf(Date);
  });

  it('reports a write that returns no row, rather than returning undefined', async () => {
    mocks.insertReturning.mockResolvedValue([]);

    await expect(addWatchedLocation({ userId: 'user-1', request })).rejects.toThrow(
      'Failed to add watched location',
    );
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'weatherMonitoring.addWatchedLocation' }),
    );
  });

  it('reports a write failure with the location attached, then rethrows', async () => {
    const failure = new Error('deadlock');
    mocks.insertReturning.mockRejectedValue(failure);

    await expect(addWatchedLocation({ userId: 'user-1', request })).rejects.toThrow('deadlock');
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failure,
        userId: 'user-1',
        extra: { weatherLocationId: 42 },
      }),
    );
  });
});

describe('removeWatchedLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteReturning.mockResolvedValue([storedRow]);
  });

  it('reports success when a row was deleted', async () => {
    const result = await removeWatchedLocation({
      userId: 'user-1',
      watchedLocationId: 'watch-1',
    });

    expect(result).toBe(true);
  });

  it('reports failure when the row does not belong to the caller, so the route can 404', async () => {
    mocks.deleteReturning.mockResolvedValue([]);

    const result = await removeWatchedLocation({
      userId: 'user-1',
      watchedLocationId: 'someone-elses',
    });

    expect(result).toBe(false);
  });

  it('scopes the delete by both row id and user so one user cannot remove another’s', async () => {
    await removeWatchedLocation({ userId: 'user-1', watchedLocationId: 'watch-1' });

    expect(mocks.deleteWhere).toHaveBeenCalledWith({
      and: [
        { col: 'id', val: 'watch-1' },
        { col: 'userId', val: 'user-1' },
      ],
    });
  });

  it('reports a delete failure to Sentry, then rethrows', async () => {
    const failure = new Error('timeout');
    mocks.deleteReturning.mockRejectedValue(failure);

    await expect(
      removeWatchedLocation({ userId: 'user-1', watchedLocationId: 'watch-1' }),
    ).rejects.toThrow('timeout');
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({
        error: failure,
        operation: 'weatherMonitoring.removeWatchedLocation',
        extra: { watchedLocationId: 'watch-1' },
      }),
    );
  });
});
