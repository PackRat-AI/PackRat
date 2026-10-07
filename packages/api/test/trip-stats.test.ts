import { beforeEach, describe, expect, it } from 'vitest';
import { seedAndLoginTestUser } from './utils/db-helpers';
import { api, apiWithAuth, expectUnauthorized, httpMethods } from './utils/test-helpers';

const now = new Date().toISOString();

const annualGoal = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  kind: 'annual',
  metric: 'distance',
  target: 804_672,
  year: 2026,
  localCreatedAt: now,
  localUpdatedAt: now,
  ...overrides,
});

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  kind: 'summit',
  name: 'Mount Whitney',
  elevationMeters: 4421,
  latitude: 36.5785,
  longitude: -118.292,
  date: '2019-08-14T00:00:00.000Z',
  localCreatedAt: now,
  localUpdatedAt: now,
  ...overrides,
});

describe('Trip Stats Routes', () => {
  beforeEach(async () => {
    await seedAndLoginTestUser();
  });

  describe('Authentication', () => {
    it('GET /trip-stats/settings requires auth', async () => {
      expectUnauthorized(await api('/trip-stats/settings', httpMethods.get()));
    });

    it('GET /trip-stats/goals requires auth', async () => {
      expectUnauthorized(await api('/trip-stats/goals', httpMethods.get()));
    });
  });

  describe('settings', () => {
    it('reads as undecided with no reason before anything is saved', async () => {
      const res = await apiWithAuth('/trip-stats/settings');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        enabled: null,
        breakReason: null,
        breakReasonTripId: null,
      });
    });

    it('stores and replaces the whole settings record', async () => {
      const first = await apiWithAuth(
        '/trip-stats/settings',
        httpMethods.put({ enabled: true, breakReason: 'injury', breakReasonTripId: 'trip-1' }),
      );
      expect(first.status).toBe(200);

      await apiWithAuth('/trip-stats/settings', httpMethods.put({ enabled: true }));

      const res = await apiWithAuth('/trip-stats/settings');
      expect(await res.json()).toEqual({
        enabled: true,
        breakReason: null,
        breakReasonTripId: null,
      });
    });

    it('rejects an unknown break reason', async () => {
      const res = await apiWithAuth(
        '/trip-stats/settings',
        httpMethods.put({ enabled: true, breakReason: 'boredom' }),
      );
      expect(res.status).toBe(422);
    });
  });

  describe('goals', () => {
    it('creates, lists, replaces and deletes a goal', async () => {
      const goal = annualGoal();
      const created = await apiWithAuth('/trip-stats/goals', httpMethods.post(goal));
      expect(created.status).toBe(200);
      expect(await created.json()).toMatchObject({
        id: goal.id,
        kind: 'annual',
        metric: 'distance',
        target: 804_672,
        year: 2026,
        deleted: false,
      });

      const updated = await apiWithAuth(
        `/trip-stats/goals/${goal.id}`,
        httpMethods.put({ kind: 'annual', metric: 'nights', target: 20, year: 2026 }),
      );
      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({ metric: 'nights', target: 20 });

      const listed = await apiWithAuth('/trip-stats/goals');
      const goals = await listed.json();
      expect(goals).toHaveLength(1);
      expect(goals[0]).toMatchObject({ id: goal.id, metric: 'nights' });

      const deleted = await apiWithAuth(`/trip-stats/goals/${goal.id}`, httpMethods.delete());
      expect(deleted.status).toBe(200);
      expect(await (await apiWithAuth('/trip-stats/goals')).json()).toEqual([]);
    });

    it('stores a custom goal window and drops the year', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(
          annualGoal({
            kind: 'custom',
            metric: 'nights',
            target: 10,
            name: 'Ten nights before the baby',
            startDate: '2026-03-01T00:00:00.000Z',
            endDate: '2026-11-30T00:00:00.000Z',
          }),
        ),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        kind: 'custom',
        year: null,
        name: 'Ten nights before the baby',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-11-30T00:00:00.000Z',
      });
    });

    it('refuses an annual goal without a year', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(annualGoal({ year: null })),
      );
      expect(res.status).toBe(422);
    });

    it('refuses a custom goal that ends before it starts', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(
          annualGoal({
            kind: 'custom',
            startDate: '2026-11-30T00:00:00.000Z',
            endDate: '2026-03-01T00:00:00.000Z',
          }),
        ),
      );
      expect(res.status).toBe(422);
    });

    it('stores a long-trail goal with its trail and an open start', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(
          annualGoal({
            kind: 'longTrail',
            year: null,
            target: 4_264_788,
            trailCode: 'PCT',
            endDate: '2030-09-30T00:00:00.000Z',
            peaks: [{ name: 'Mount Whitney' }],
          }),
        ),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        kind: 'longTrail',
        trailCode: 'PCT',
        startDate: null,
        endDate: '2030-09-30T00:00:00.000Z',
        peaks: null,
        parkCodes: null,
      });
    });

    it('refuses a long-trail goal with no trail', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(annualGoal({ kind: 'longTrail', year: null })),
      );
      expect(res.status).toBe(422);
    });

    it('stores a peak list and refuses an empty one', async () => {
      const peaks = [
        { name: 'Mount Whitney', elevationMeters: 4421, osmId: 358_910_543 },
        { name: 'Mount Rainier', elevationMeters: 4392 },
      ];
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(
          annualGoal({ kind: 'peakList', metric: 'summits', target: 2, year: null, peaks }),
        ),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ kind: 'peakList', year: null, peaks });

      const empty = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(annualGoal({ kind: 'peakList', year: null, peaks: [] })),
      );
      expect(empty.status).toBe(422);
    });

    it('reads an empty park list as every park', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals',
        httpMethods.post(
          annualGoal({ kind: 'parkList', metric: 'parks', target: 63, year: null, parkCodes: [] }),
        ),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ kind: 'parkList', parkCodes: null });
    });

    it('answers a replayed create with 409 rather than a duplicate', async () => {
      const goal = annualGoal();
      await apiWithAuth('/trip-stats/goals', httpMethods.post(goal));
      const replay = await apiWithAuth('/trip-stats/goals', httpMethods.post(goal));
      expect(replay.status).toBe(409);
      expect(await (await apiWithAuth('/trip-stats/goals')).json()).toHaveLength(1);
    });

    it('404s when replacing a goal that does not exist', async () => {
      const res = await apiWithAuth(
        '/trip-stats/goals/missing',
        httpMethods.put({ kind: 'annual', metric: 'trips', target: 5, year: 2026 }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('entries', () => {
    it('requires auth', async () => {
      expectUnauthorized(await api('/trip-stats/entries', httpMethods.get()));
    });

    it('creates, lists, replaces and soft-deletes a summit', async () => {
      const summit = entry();
      const created = await apiWithAuth('/trip-stats/entries', httpMethods.post(summit));
      expect(created.status).toBe(200);
      expect(await created.json()).toMatchObject({ kind: 'summit', name: 'Mount Whitney' });

      const replaced = await apiWithAuth(
        `/trip-stats/entries/${summit.id}`,
        httpMethods.put({
          ...entry({ name: 'Mt. Whitney', elevationMeters: 4418 }),
          id: undefined,
        }),
      );
      expect(await replaced.json()).toMatchObject({ name: 'Mt. Whitney', elevationMeters: 4418 });

      await apiWithAuth(`/trip-stats/entries/${summit.id}`, httpMethods.delete());
      expect(await (await apiWithAuth('/trip-stats/entries')).json()).toEqual([]);
    });

    it('keeps only park fields on a park visit', async () => {
      const visit = entry({ kind: 'park', parkCode: 'YOSE' });
      const res = await apiWithAuth('/trip-stats/entries', httpMethods.post(visit));
      expect(await res.json()).toMatchObject({ kind: 'park', parkCode: 'YOSE', name: null });
    });

    it('refuses a park visit with no park', async () => {
      const res = await apiWithAuth(
        '/trip-stats/entries',
        httpMethods.post(entry({ kind: 'park', parkCode: null })),
      );
      expect(res.status).toBe(422);
    });

    it('answers a replayed create with 409', async () => {
      const summit = entry();
      await apiWithAuth('/trip-stats/entries', httpMethods.post(summit));
      const replay = await apiWithAuth('/trip-stats/entries', httpMethods.post(summit));
      expect(replay.status).toBe(409);
    });
  });

  describe('nearby peaks', () => {
    it('refuses a bounding box too large to ask Overpass for', async () => {
      const res = await apiWithAuth(
        '/trip-stats/peaks/nearby?south=30&west=-120&north=40&east=-110',
      );
      expect(res.status).toBe(422);
    });
  });
});
