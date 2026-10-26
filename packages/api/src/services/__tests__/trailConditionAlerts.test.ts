import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTripTrailConditions: vi.fn(),
  canAccessFeature: vi.fn(),
  hasProEntitlement: vi.fn(),
  pushToUser: vi.fn(),
  captureApiException: vi.fn(),
}));

vi.mock('@packrat/api/services/tripTrailConditions', () => ({
  getTripTrailConditions: mocks.getTripTrailConditions,
  TRIP_NEARBY_RADIUS_M: 25_000,
}));
vi.mock('@packrat/api/services/featureAccessService', () => ({
  canAccessFeature: mocks.canAccessFeature,
}));
vi.mock('@packrat/api/services/entitlementsService', () => ({
  hasProEntitlement: mocks.hasProEntitlement,
}));
vi.mock('@packrat/api/services/push/pushToUser', () => ({ pushToUser: mocks.pushToUser }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));

import {
  getTrailConditionNotificationsEnabled,
  isTripActive,
  listUnreadTripIds,
  markReportsRead,
  notifyTripsOfReport,
  setTrailConditionNotificationsEnabled,
  trailReportNotification,
  unreadReportIds,
} from '../trailConditionAlerts';

type Db = Parameters<typeof unreadReportIds>[0]['db'];
type TrailDb = NonNullable<Parameters<typeof notifyTripsOfReport>[0]['trailDb']>;

/**
 * A query builder stand-in: every chained call returns the same chain, and
 * awaiting it yields what `results` holds for the query's tag. Each call to
 * a tag is recorded with the methods and arguments it chained.
 */
function fakeDb(results: Record<string, unknown | ((call: number) => unknown)>) {
  const calls: { label: string; chain: { method: string; args: unknown[] }[] }[] = [];
  const counts = new Map<string, number>();
  const db = {
    tag(label: string) {
      const call = { label, chain: [] as { method: string; args: unknown[] }[] };
      calls.push(call);
      const n = counts.get(label) ?? 0;
      counts.set(label, n + 1);
      const chain: Record<string, unknown> = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              const value = results[label];
              const resolved = typeof value === 'function' ? value(n) : value;
              return (resolve: (v: unknown) => void) => resolve(resolved ?? []);
            }
            return (...args: unknown[]) => {
              call.chain.push({ method: String(prop), args });
              return chain;
            };
          },
        },
      );
      return chain;
    },
  };
  return { db: db as unknown as Db, calls };
}

const NOW = new Date('2026-10-24T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * DAY);

const env = {} as ValidatedEnv;

describe('isTripActive', () => {
  it('counts a trip starting within two weeks as upcoming', () => {
    expect(
      isTripActive({
        trip: { status: 'planned', startDate: daysFromNow(13), endDate: null },
        now: NOW,
      }),
    ).toBe(true);
  });

  it('leaves out a trip starting more than two weeks away', () => {
    expect(
      isTripActive({
        trip: { status: 'planned', startDate: daysFromNow(15), endDate: null },
        now: NOW,
      }),
    ).toBe(false);
  });

  it('keeps a planned trip active until a day after its last day', () => {
    const trip = { status: 'planned' as const, startDate: daysFromNow(-5), endDate: NOW };
    expect(isTripActive({ trip, now: NOW })).toBe(true);
    expect(isTripActive({ trip: { ...trip, endDate: daysFromNow(-2) }, now: NOW })).toBe(false);
  });

  it('treats a trip in progress as active and a finished or undated one as not', () => {
    expect(
      isTripActive({ trip: { status: 'in_progress', startDate: null, endDate: null }, now: NOW }),
    ).toBe(true);
    expect(
      isTripActive({ trip: { status: 'complete', startDate: NOW, endDate: NOW }, now: NOW }),
    ).toBe(false);
    expect(
      isTripActive({ trip: { status: 'planned', startDate: null, endDate: null }, now: NOW }),
    ).toBe(false);
  });
});

describe('trailReportNotification', () => {
  it('names the trip, the trail, what the condition means and the hazards', () => {
    expect(
      trailReportNotification({
        tripName: 'Half Dome',
        report: { trailName: 'Mist Trail', overallCondition: 'fair', hazards: ['Ice', 'Wildlife'] },
        nearby: false,
      }),
    ).toEqual({
      title: 'New trail report for Half Dome',
      body: 'Mist Trail: Passable with care. Ice, Wildlife.',
    });
  });

  it('says a nearby trail is near the trip and falls back for an unknown rating', () => {
    expect(
      trailReportNotification({
        tripName: 'Yosemite',
        report: { trailName: 'Four Mile', overallCondition: 'muddy', hazards: [] },
        nearby: true,
      }).body,
    ).toBe('Four Mile, near your trip: New conditions.');
  });
});

const activeTrip = {
  status: 'planned' as const,
  startDate: daysFromNow(3),
  endDate: null,
  createdAt: daysFromNow(-10),
};

const sectionReport = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id,
  userId: 'other',
  createdAt: daysFromNow(-1),
  localCreatedAt: daysFromNow(-1),
  ...overrides,
});

describe('unreadReportIds', () => {
  it('returns recent reports by others, written after the trip was planned, not yet read', async () => {
    const { db, calls } = fakeDb({ 'trailConditionAlerts.listReads': [{ reportId: 'read' }] });
    const ids = await unreadReportIds({
      db,
      trip: activeTrip,
      viewerId: 'me',
      now: NOW,
      reports: [
        sectionReport('fresh'),
        sectionReport('read'),
        sectionReport('mine', { userId: 'me' }),
        sectionReport('before-trip', { createdAt: daysFromNow(-20) }),
        sectionReport('old', { localCreatedAt: daysFromNow(-15) }),
      ],
    });
    expect([...ids]).toEqual(['fresh']);
    expect(calls).toHaveLength(1);
  });

  it('marks nothing on a trip that is not upcoming or in progress, without querying', async () => {
    const { db, calls } = fakeDb({});
    const ids = await unreadReportIds({
      db,
      trip: { ...activeTrip, status: 'complete' },
      viewerId: 'me',
      now: NOW,
      reports: [sectionReport('fresh')],
    });
    expect(ids.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('skips the read lookup when no report qualifies', async () => {
    const { db, calls } = fakeDb({});
    const ids = await unreadReportIds({
      db,
      trip: activeTrip,
      viewerId: 'me',
      now: NOW,
      reports: [sectionReport('mine', { userId: 'me' })],
    });
    expect(ids.size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('markReportsRead', () => {
  it('records each report as read by the user, ignoring ones already read', async () => {
    const { db, calls } = fakeDb({});
    await markReportsRead({ db, userId: 'me', reportIds: ['a', 'b'] });
    expect(calls[0]?.chain.map((c) => c.method)).toEqual([
      'insert',
      'values',
      'onConflictDoNothing',
    ]);
    expect(calls[0]?.chain[1]?.args[0]).toEqual([
      { userId: 'me', reportId: 'a' },
      { userId: 'me', reportId: 'b' },
    ]);
  });

  it('does nothing for an empty list', async () => {
    const { db, calls } = fakeDb({});
    await markReportsRead({ db, userId: 'me', reportIds: [] });
    expect(calls).toHaveLength(0);
  });
});

describe('notification preference', () => {
  it('is on when the user never set it', async () => {
    const { db } = fakeDb({ 'trailConditionAlerts.getPreference': [] });
    expect(await getTrailConditionNotificationsEnabled({ db, userId: 'me' })).toBe(true);
  });

  it('reads the stored switch', async () => {
    const { db } = fakeDb({ 'trailConditionAlerts.getPreference': [{ trailConditions: false }] });
    expect(await getTrailConditionNotificationsEnabled({ db, userId: 'me' })).toBe(false);
  });

  it('upserts the switch', async () => {
    const { db, calls } = fakeDb({});
    await setTrailConditionNotificationsEnabled({ db, userId: 'me', enabled: false });
    expect(calls[0]?.chain.map((c) => c.method)).toEqual([
      'insert',
      'values',
      'onConflictDoUpdate',
    ]);
    expect(calls[0]?.chain[1]?.args[0]).toMatchObject({ userId: 'me', trailConditions: false });
  });
});

const tripRow = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id,
  userId: `owner-${id}`,
  name: `Trip ${id}`,
  trailId: 'trail-1',
  location: { latitude: 37.7, longitude: -119.5, name: 'Valley' },
  status: 'planned',
  startDate: daysFromNow(3),
  endDate: null,
  createdAt: daysFromNow(-10),
  ...overrides,
});

describe('listUnreadTripIds', () => {
  it('lists active trips whose section holds an unread report', async () => {
    const { db } = fakeDb({
      'trailConditionAlerts.listActiveTrips': [tripRow('a'), tripRow('b', { location: null })],
      'trailConditionAlerts.listReads': [],
    });
    mocks.getTripTrailConditions
      .mockResolvedValueOnce({ scope: 'trail', reports: [sectionReport('r1')] })
      .mockResolvedValueOnce({ scope: 'trail', reports: [] });
    const ids = await listUnreadTripIds({ db, trailDb: null, userId: 'me', now: NOW });
    expect(ids).toEqual(['a']);
    expect(mocks.getTripTrailConditions.mock.calls[0]?.[0].trip.location).toEqual({
      latitude: 37.7,
      longitude: -119.5,
    });
  });
});

const report = {
  id: 'report-1',
  userId: 'author',
  trailId: 'trail-1',
  trailName: 'Mist Trail',
  overallCondition: 'poor',
  hazards: ['Ice'],
};

function trailDbReturning(tripIds: string[]): TrailDb {
  const execute = vi.fn().mockResolvedValue({ rows: tripIds.map((trip_id) => ({ trip_id })) });
  return { tag: () => ({ execute }) };
}

describe('notifyTripsOfReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccessFeature.mockResolvedValue(true);
    mocks.hasProEntitlement.mockResolvedValue(false);
    mocks.pushToUser.mockResolvedValue(undefined);
    mocks.getTripTrailConditions.mockImplementation(async ({ trip }) => ({
      scope: trip.trailId ? 'trail' : 'nearby',
      reports: [{ id: 'report-1' }],
    }));
  });

  it('never notifies for a pinned report', async () => {
    const { db, calls } = fakeDb({});
    const result = await notifyTripsOfReport({
      env,
      db,
      trailDb: null,
      report: { ...report, trailId: null },
      now: NOW,
    });
    expect(result.notifiedTripIds).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('notifies the owner of a trip on the trail, opening the report on that trip', async () => {
    const { db } = fakeDb({
      'trailConditionAlerts.candidateTrips': [tripRow('a')],
      'trailConditionAlerts.claimNotification': [{ tripId: 'a' }],
    });
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual(['a']);
    expect(mocks.pushToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-a',
        payload: {
          alert: { title: 'New trail report for Trip a', body: 'Mist Trail: Tough going. Ice.' },
          tripId: 'a',
          reportId: 'report-1',
        },
      }),
    );
  });

  it('notifies a trailless trip only when its destination is near the trail', async () => {
    const { db } = fakeDb({
      'trailConditionAlerts.candidateTrips': [
        tripRow('near', { trailId: null }),
        tripRow('far', { trailId: null }),
        tripRow('nowhere', { trailId: null, location: null }),
      ],
      'trailConditionAlerts.claimNotification': [{ tripId: 'near' }],
    });
    const result = await notifyTripsOfReport({
      env,
      db,
      trailDb: trailDbReturning(['near']),
      report,
      now: NOW,
    });
    expect(result.notifiedTripIds).toEqual(['near']);
    expect(mocks.pushToUser.mock.calls[0]?.[0].payload.alert.body).toBe(
      'Mist Trail, near your trip: Tough going. Ice.',
    );
  });

  it('skips trailless trips when there is no trail database', async () => {
    const { db } = fakeDb({
      'trailConditionAlerts.candidateTrips': [tripRow('near', { trailId: null })],
    });
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual([]);
  });

  it('holds back owners who turned these off or lack access', async () => {
    const { db } = fakeDb({
      'trailConditionAlerts.candidateTrips': [tripRow('muted'), tripRow('locked')],
      'trailConditionAlerts.listMuted': [{ userId: 'owner-muted' }],
    });
    mocks.canAccessFeature.mockResolvedValue(false);
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual([]);
    expect(mocks.canAccessFeature).toHaveBeenCalledTimes(1);
    expect(mocks.pushToUser).toHaveBeenCalledTimes(0);
  });

  it("skips a trip whose section doesn't show the report to its owner", async () => {
    const { db } = fakeDb({ 'trailConditionAlerts.candidateTrips': [tripRow('a')] });
    mocks.getTripTrailConditions.mockResolvedValue({ scope: 'trail', reports: [] });
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual([]);
    expect(mocks.pushToUser).toHaveBeenCalledTimes(0);
  });

  it('sends at most one a day: a trip already notified today is skipped', async () => {
    const { db, calls } = fakeDb({
      'trailConditionAlerts.candidateTrips': [tripRow('a')],
      'trailConditionAlerts.claimNotification': [],
    });
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual([]);
    const claim = calls.find((c) => c.label === 'trailConditionAlerts.claimNotification');
    const upsert = claim?.chain.find((c) => c.method === 'onConflictDoUpdate')?.args[0] as {
      setWhere: unknown;
    };
    expect(upsert.setWhere).toBeTruthy();
  });

  it('reports a failing trip and carries on with the rest', async () => {
    const { db } = fakeDb({
      'trailConditionAlerts.candidateTrips': [tripRow('a'), tripRow('b')],
      'trailConditionAlerts.claimNotification': [{ tripId: 'x' }],
    });
    mocks.pushToUser.mockRejectedValueOnce(new Error('gateway down'));
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual(['b']);
    expect(mocks.captureApiException).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'trailConditionAlerts.notifyTrip' }),
    );
  });

  it('returns early when no trip is affected', async () => {
    const { db, calls } = fakeDb({ 'trailConditionAlerts.candidateTrips': [] });
    const result = await notifyTripsOfReport({ env, db, trailDb: null, report, now: NOW });
    expect(result.notifiedTripIds).toEqual([]);
    expect(calls.map((c) => c.label)).toEqual(['trailConditionAlerts.candidateTrips']);
  });
});
