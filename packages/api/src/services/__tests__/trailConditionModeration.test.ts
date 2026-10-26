import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every query starts with `db.tag(label)`, so the fake db records each tagged
 * chain (label + method calls) and resolves it with whatever the test queued
 * for that label, defaulting to `[]`.
 */
type Call = { method: string; args: unknown[] };
type Query = { label: string; calls: Call[] };

const mocks = vi.hoisted(() => ({
  queries: [] as Array<{ label: string; calls: Array<{ method: string; args: unknown[] }> }>,
  results: new Map<string, unknown[]>(),
}));

function chain(query: Query): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          const queued = mocks.results.get(query.label);
          const value = queued && queued.length > 0 ? queued.shift() : [];
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (typeof prop === 'symbol') return undefined;
        return (...args: unknown[]) => {
          query.calls.push({ method: prop, args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

vi.mock('@packrat/api/db', () => ({
  createDb: () => ({
    tag: (label: string) => {
      const query: Query = { label, calls: [] };
      mocks.queries.push(query);
      return chain(query);
    },
  }),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: () => ({ R2_PUBLIC_URL: 'https://cdn.example.com/' }),
}));

import {
  listPendingTrailFlags,
  resolveTrailFlags,
} from '@packrat/api/services/trailConditionModeration';

function respond(label: string, ...values: unknown[]) {
  mocks.results.set(label, [...(mocks.results.get(label) ?? []), ...values]);
}

function queriesFor(label: string): Query[] {
  return mocks.queries.filter((q) => q.label === label);
}

function argOf(label: string, method: string): unknown {
  return queriesFor(label)[0]?.calls.find((c) => c.method === method)?.args[0];
}

const at = (day: number) => new Date(`2026-10-0${day}T00:00:00.000Z`);

const flag = ({
  reportId,
  reason,
  day,
  reporterId,
}: {
  reportId: string;
  reason: string;
  day: number;
  reporterId: string;
}) => ({
  reportId,
  reason,
  createdAt: at(day),
  reporterId,
  reporterFirstName: reporterId.toUpperCase(),
  reporterLastName: null,
});

const report = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  trailId: `trail-${id}`,
  trailName: `Trail ${id}`,
  overallCondition: 'poor',
  hazards: ['ice'],
  notes: null,
  photos: [],
  localCreatedAt: at(1),
  userId: `author-${id}`,
  firstName: 'Maya',
  lastName: null,
  avatarUrl: null,
  ...extra,
});

beforeEach(() => {
  mocks.queries.length = 0;
  mocks.results.clear();
});

describe('listPendingTrailFlags', () => {
  it('returns nothing and skips the report lookup when no flags are pending', async () => {
    expect(await listPendingTrailFlags()).toEqual([]);
    expect(queriesFor('trailConditions.admin.getFlaggedReports')).toHaveLength(0);
  });

  it('groups flags per report with counts, unique reasons and reporters, most-flagged first', async () => {
    respond('trailConditions.admin.listPendingFlags', [
      flag({ reportId: 'a', reason: 'spam', day: 2, reporterId: 'r1' }),
      flag({ reportId: 'b', reason: 'inaccurate', day: 3, reporterId: 'r1' }),
      flag({ reportId: 'b', reason: 'inaccurate', day: 4, reporterId: 'r2' }),
      flag({ reportId: 'b', reason: 'offensive', day: 5, reporterId: 'r2' }),
      flag({ reportId: 'c', reason: 'spam', day: 6, reporterId: 'r3' }),
      // Deleted by its author since it was flagged, so the lookup misses it.
      flag({ reportId: 'gone', reason: 'spam', day: 7, reporterId: 'r3' }),
    ]);
    respond('trailConditions.admin.getFlaggedReports', [
      report('a'),
      report('b', { photos: ['k.jpg', 'https://other.example/x.jpg'], notes: 'Ice past mile 2' }),
      report('c'),
    ]);

    const result = await listPendingTrailFlags();

    expect(result.map((g) => [g.reportId, g.flagCount])).toEqual([
      ['b', 3],
      ['a', 1], // ties broken oldest-first
      ['c', 1],
    ]);
    expect(result[0]).toEqual({
      reportId: 'b',
      trailId: 'trail-b',
      trailName: 'Trail b',
      overallCondition: 'poor',
      hazards: ['ice'],
      notes: 'Ice past mile 2',
      photos: ['https://cdn.example.com/k.jpg', 'https://other.example/x.jpg'],
      author: { id: 'author-b', firstName: 'Maya', lastName: null, avatarUrl: null },
      writtenAt: at(1).toISOString(),
      flagCount: 3,
      reasons: ['inaccurate', 'offensive'],
      reporters: [
        { id: 'r1', firstName: 'R1', lastName: null },
        { id: 'r2', firstName: 'R2', lastName: null },
      ],
      firstFlaggedAt: at(3).toISOString(),
      lastFlaggedAt: at(5).toISOString(),
    });
  });
});

describe('resolveTrailFlags', () => {
  it('dismisses: leaves the report up and marks its pending flags dismissed', async () => {
    const result = await resolveTrailFlags({ reportId: 'a', action: 'dismiss' });

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(queriesFor('trailConditions.admin.removeReport')).toHaveLength(0);
    expect(argOf('trailConditions.admin.resolveFlags', 'set')).toEqual({
      status: 'dismissed',
      reviewedAt: expect.any(Date),
    });
  });

  it('removes: deletes the report for everyone and marks its flags removed', async () => {
    respond('trailConditions.admin.removeReport', [{ id: 'a' }]);

    const result = await resolveTrailFlags({ reportId: 'a', action: 'remove' });

    expect(result).toEqual({ ok: true, value: { success: true } });
    expect(argOf('trailConditions.admin.removeReport', 'set')).toEqual({
      deleted: true,
      updatedAt: expect.any(Date),
    });
    expect(argOf('trailConditions.admin.resolveFlags', 'set')).toEqual({
      status: 'removed',
      reviewedAt: expect.any(Date),
    });
  });

  it('404s and closes nothing when the report to remove is gone', async () => {
    const result = await resolveTrailFlags({ reportId: 'gone', action: 'remove' });

    expect(result).toEqual({ ok: false, status: 404, error: 'Report not found' });
    expect(queriesFor('trailConditions.admin.resolveFlags')).toHaveLength(0);
  });
});
