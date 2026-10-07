import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every query is `db.tag(label)...`; the chain resolves to the next queued
// result for that label (the last one repeats), and records each builder call.
const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown[]>();
  const calls: { label: string; method: string; args: unknown[] }[] = [];
  const next = (label: string) => {
    const queue = results.get(label) ?? [];
    return Promise.resolve(queue.length > 1 ? queue.shift() : (queue[0] ?? []));
  };
  const chain = (label: string): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            const promise = next(label);
            return promise.then.bind(promise);
          }
          return (...args: unknown[]) => {
            calls.push({ label, method: String(prop), args });
            return chain(label);
          };
        },
      },
    );
  return {
    results,
    calls,
    createDb: vi.fn(() => ({ tag: (label: string) => chain(label) })),
    getEnv: vi.fn(),
    deliverToContacts: vi.fn(),
  };
});

vi.mock('@packrat/api/db', () => ({ createDb: mocks.createDb }));
vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: mocks.getEnv }));
vi.mock('../delivery', () => ({ deliverToContacts: mocks.deliverToContacts }));

import {
  addLocations,
  CheckInError,
  displayName,
  endCheckIn,
  extendCheckIn,
  generateShareToken,
  getActiveCheckInForTrip,
  getPublicView,
  overdueAt,
  shareUrlFor,
  startCheckIn,
} from '../checkInService';

const when = (label: string, ...values: unknown[]) => mocks.results.set(label, values);
const callsFor = (label: string, method: string) =>
  mocks.calls.filter((c) => c.label === label && c.method === method).map((c) => c.args[0]);
const deliveries = () =>
  mocks.deliverToContacts.mock.calls.map(
    (c) => c[0] as { operation: string; message: { text: string }; contacts: unknown[] },
  );

const STARTED = new Date('2026-09-13T15:00:00.000Z');
const RETURN = new Date('2026-09-14T02:00:00.000Z');

const checkInRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ci-1',
  tripId: 't1',
  userId: 'u1',
  status: 'active',
  shareToken: 'tok123',
  expectedReturnAt: RETURN,
  timeZone: 'America/Los_Angeles',
  graceMinutes: 120,
  identifyingGear: [{ name: 'tent', note: 'orange' }],
  trackingEnabled: true,
  startedAt: STARTED,
  overdueAlertSentAt: null,
  offRouteNotifiedAt: null,
  endedAt: null,
  createdAt: STARTED,
  updatedAt: STARTED,
  ...overrides,
});

const contactSnapshot = { contactId: 'c1', name: 'Mom', phone: '+15005550006', email: null };
const trip = { id: 't1', name: 'Enchantments', plannedRoute: null };
const user = { name: 'Alex Tester', firstName: 'Alex' };

const startRequest = {
  id: 'ci-1',
  contactIds: ['c1', 'c2'],
  expectedReturnAt: RETURN.toISOString(),
  graceMinutes: 120,
  identifyingGear: [{ name: 'tent', note: 'orange' }],
  trackingEnabled: true,
  startedAt: STARTED.toISOString(),
  timeZone: 'America/Los_Angeles',
};

beforeEach(() => {
  mocks.results.clear();
  mocks.calls.length = 0;
  vi.clearAllMocks();
  mocks.getEnv.mockReturnValue({ PACKRAT_API_URL: 'https://api.example.com/' });
  mocks.deliverToContacts.mockResolvedValue([]);
  when('safetyCheckIn.listCheckInContacts', [contactSnapshot]);
  when('safetyCheckIn.latestLocation', []);
  when('safetyCheckIn.getTrip', [trip]);
  when('safetyCheckIn.getUser', [user]);
});

describe('helpers', () => {
  it('shareUrlFor trims the trailing slash and falls back to the default host', () => {
    expect(shareUrlFor('abc')).toBe('https://api.example.com/api/safety/abc');
    mocks.getEnv.mockReturnValue({});
    expect(shareUrlFor('abc')).toBe('https://api.packrat.app/api/safety/abc');
  });

  it('generateShareToken is url-safe, unpadded and unique', () => {
    const a = generateShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(generateShareToken()).not.toBe(a);
  });

  it('overdueAt adds the grace period', () => {
    expect(overdueAt({ expectedReturnAt: RETURN, graceMinutes: 90 }).toISOString()).toBe(
      '2026-09-14T03:30:00.000Z',
    );
  });

  it('displayName prefers first name, then name, then a fallback', () => {
    expect(displayName({ name: 'Alex Tester', firstName: ' Alex ' })).toBe('Alex');
    expect(displayName({ name: 'Alex Tester', firstName: null })).toBe('Alex Tester');
    expect(displayName({ name: ' ', firstName: '' })).toBe('Your contact');
  });

  it('CheckInError carries its status', () => {
    const error = new CheckInError({ message: 'nope', httpStatus: 409 });
    expect(error.httpStatus).toBe(409);
    expect(error.name).toBe('CheckInError');
  });
});

describe('getActiveCheckInForTrip', () => {
  it('returns null when there is none', async () => {
    when('safetyCheckIn.getActiveForTrip', []);
    expect(await getActiveCheckInForTrip({ userId: 'u1', tripId: 't1' })).toBeNull();
  });

  it('maps the active row to the response shape', async () => {
    when('safetyCheckIn.getActiveForTrip', [checkInRow()]);
    when('safetyCheckIn.latestLocation', [
      {
        id: 'l1',
        kind: 'check_in',
        latitude: 1,
        longitude: 2,
        placeName: null,
        note: null,
        recordedAt: STARTED,
      },
    ]);

    expect(await getActiveCheckInForTrip({ userId: 'u1', tripId: 't1' })).toEqual({
      id: 'ci-1',
      tripId: 't1',
      status: 'active',
      shareUrl: 'https://api.example.com/api/safety/tok123',
      expectedReturnAt: RETURN.toISOString(),
      graceMinutes: 120,
      overdueAt: '2026-09-14T04:00:00.000Z',
      identifyingGear: [{ name: 'tent', note: 'orange' }],
      trackingEnabled: true,
      startedAt: STARTED.toISOString(),
      overdueAlertSentAt: null,
      endedAt: null,
      contacts: [{ contactId: 'c1', name: 'Mom' }],
      lastLocation: {
        id: 'l1',
        kind: 'check_in',
        latitude: 1,
        longitude: 2,
        placeName: null,
        note: null,
        recordedAt: STARTED.toISOString(),
      },
    });
  });
});

describe('startCheckIn', () => {
  const ready = () => {
    when('safetyCheckIn.get', []);
    when('safetyCheckIn.getActiveForTrip', []);
    when('safetyCheckIn.getContactsForStart', [
      { id: 'c1', name: 'Mom', phone: '+15005550006', email: null, introducedAt: null },
      { id: 'c2', name: 'Dad', phone: null, email: 'd@example.com', introducedAt: STARTED },
    ]);
    when('safetyCheckIn.create', [checkInRow()]);
  };

  it('creates the check-in, starts the trip, introduces new contacts and notifies all', async () => {
    ready();
    const result = await startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest });

    expect(result.id).toBe('ci-1');
    expect(callsFor('safetyCheckIn.create', 'values')[0]).toMatchObject({
      id: 'ci-1',
      tripId: 't1',
      userId: 'u1',
      expectedReturnAt: RETURN,
      startedAt: STARTED,
      timeZone: 'America/Los_Angeles',
      graceMinutes: 120,
      trackingEnabled: true,
    });
    const snapshot = callsFor('safetyCheckIn.snapshotContacts', 'values')[0] as {
      contactId: string;
      checkInId: string;
    }[];
    expect(snapshot.map((s) => [s.contactId, s.checkInId])).toEqual([
      ['c1', 'ci-1'],
      ['c2', 'ci-1'],
    ]);
    expect(callsFor('safetyCheckIn.markTripStarted', 'set')[0]).toMatchObject({
      status: 'in_progress',
      startedAt: STARTED,
    });

    const sent = deliveries();
    expect(sent.map((d) => d.operation)).toEqual(['intro', 'start']);
    expect(sent[0]?.contacts).toHaveLength(1);
    expect(sent[0]?.message.text).toContain('PackRat: Alex added you as an emergency contact.');
    expect(sent[1]?.contacts).toHaveLength(2);
    expect(sent[1]?.message.text).toContain(
      'Track live progress: https://api.example.com/api/safety/',
    );
    expect(callsFor('safetyCheckIn.markContactsIntroduced', 'set')).toHaveLength(1);
  });

  it('skips the intro when every contact has already been introduced', async () => {
    ready();
    when('safetyCheckIn.getContactsForStart', [
      { id: 'c2', name: 'Dad', phone: null, email: 'd@example.com', introducedAt: STARTED },
    ]);
    await startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest });
    expect(deliveries().map((d) => d.operation)).toEqual(['start']);
    expect(callsFor('safetyCheckIn.markContactsIntroduced', 'set')).toHaveLength(0);
  });

  it('is idempotent for a replayed start', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    const result = await startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest });
    expect(result.id).toBe('ci-1');
    expect(callsFor('safetyCheckIn.create', 'values')).toHaveLength(0);
    expect(mocks.deliverToContacts).toHaveBeenCalledTimes(0);
  });

  it("409s when the id is another user's check-in", async () => {
    when('safetyCheckIn.get', [checkInRow({ userId: 'someone-else' })]);
    await expect(
      startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest }),
    ).rejects.toMatchObject({ httpStatus: 409, message: 'Check-in id is already in use' });
  });

  it('404s for a trip the user does not own', async () => {
    ready();
    when('safetyCheckIn.getTrip', []);
    await expect(
      startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('409s when the trip already has an active check-in', async () => {
    ready();
    when('safetyCheckIn.getActiveForTrip', [{ id: 'other' }]);
    await expect(
      startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest }),
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('400s without any valid contact', async () => {
    ready();
    when('safetyCheckIn.getContactsForStart', []);
    await expect(
      startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest }),
    ).rejects.toMatchObject({ httpStatus: 400, message: 'Choose at least one emergency contact' });
  });

  it('400s when the return is not after the start', async () => {
    ready();
    await expect(
      startCheckIn({
        userId: 'u1',
        tripId: 't1',
        request: { ...startRequest, expectedReturnAt: STARTED.toISOString() },
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('throws if the insert returns nothing', async () => {
    ready();
    when('safetyCheckIn.create', []);
    await expect(
      startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest }),
    ).rejects.toThrow('Failed to create check-in');
  });

  it('404s when the trip or user vanished before notifying', async () => {
    ready();
    when('safetyCheckIn.getUser', []);
    await expect(
      startCheckIn({ userId: 'u1', tripId: 't1', request: startRequest }),
    ).rejects.toMatchObject({ httpStatus: 404, message: 'Trip not found' });
  });
});

describe('extendCheckIn', () => {
  const future = new Date(Date.now() + 3 * 3_600_000).toISOString();

  it('moves the return, resets the reminder and tells contacts', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.extend', [checkInRow({ expectedReturnAt: new Date(future) })]);

    const result = await extendCheckIn({
      userId: 'u1',
      checkInId: 'ci-1',
      expectedReturnAt: future,
    });

    expect(result.expectedReturnAt).toBe(future);
    expect(callsFor('safetyCheckIn.extend', 'set')[0]).toMatchObject({
      expectedReturnAt: new Date(future),
    });
    expect(deliveries()[0]?.operation).toBe('extend');
  });

  it('404s for an unknown check-in', async () => {
    when('safetyCheckIn.get', []);
    await expect(
      extendCheckIn({ userId: 'u1', checkInId: 'x', expectedReturnAt: future }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('409s once the check-in has ended', async () => {
    when('safetyCheckIn.get', [checkInRow({ status: 'safe' })]);
    await expect(
      extendCheckIn({ userId: 'u1', checkInId: 'ci-1', expectedReturnAt: future }),
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('400s for a time in the past', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    await expect(
      extendCheckIn({ userId: 'u1', checkInId: 'ci-1', expectedReturnAt: STARTED.toISOString() }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('404s if the row disappears during the update', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.extend', []);
    await expect(
      extendCheckIn({ userId: 'u1', checkInId: 'ci-1', expectedReturnAt: future }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });
});

describe('endCheckIn', () => {
  const endedAt = '2026-09-14T01:00:00.000Z';

  it("I'm Safe deletes locations, completes the trip and says they're back", async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.end', [checkInRow({ status: 'safe', endedAt: new Date(endedAt) })]);

    const result = await endCheckIn({ userId: 'u1', checkInId: 'ci-1', outcome: 'safe', endedAt });

    expect(result.status).toBe('safe');
    expect(result.endedAt).toBe(endedAt);
    expect(callsFor('safetyCheckIn.deleteLocations', 'delete')).toHaveLength(1);
    expect(callsFor('safetyCheckIn.markTripComplete', 'set')[0]).toMatchObject({
      status: 'complete',
      completedAt: new Date(endedAt),
    });
    expect(deliveries()[0]?.message.text).toBe(
      'Alex is back safe from Enchantments. Thanks for keeping an eye out.',
    );
  });

  it("I'm Safe after the overdue alert sends the follow-up", async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.end', [checkInRow({ status: 'safe', overdueAlertSentAt: RETURN })]);

    const result = await endCheckIn({ userId: 'u1', checkInId: 'ci-1', outcome: 'safe', endedAt });

    expect(result.overdueAlertSentAt).toBe(RETURN.toISOString());
    expect(deliveries()[0]?.message.text).toContain('Update: Alex has marked themselves safe');
  });

  it('cancel does not complete the trip and says it was called off', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.end', [checkInRow({ status: 'cancelled' })]);

    await endCheckIn({ userId: 'u1', checkInId: 'ci-1', outcome: 'cancelled', endedAt });

    expect(callsFor('safetyCheckIn.markTripComplete', 'set')).toHaveLength(0);
    expect(callsFor('safetyCheckIn.deleteLocations', 'delete')).toHaveLength(1);
    expect(deliveries()[0]?.operation).toBe('cancelled');
  });

  it('is a no-op replay once already ended', async () => {
    when('safetyCheckIn.get', [checkInRow({ status: 'safe' })]);
    const result = await endCheckIn({
      userId: 'u1',
      checkInId: 'ci-1',
      outcome: 'safe',
      endedAt,
    });
    expect(result.status).toBe('safe');
    expect(mocks.deliverToContacts).toHaveBeenCalledTimes(0);
  });

  it('returns the current state when a concurrent end won the race', async () => {
    when('safetyCheckIn.get', [checkInRow()], [checkInRow({ status: 'cancelled' })]);
    when('safetyCheckIn.end', []);
    const result = await endCheckIn({ userId: 'u1', checkInId: 'ci-1', outcome: 'safe', endedAt });
    expect(result.status).toBe('cancelled');
    expect(mocks.deliverToContacts).toHaveBeenCalledTimes(0);
  });
});

describe('addLocations', () => {
  const checkInLoc = {
    id: 'l1',
    kind: 'check_in' as const,
    latitude: 47.505,
    longitude: -120.8,
    placeName: 'Colchuck Lake',
    note: 'All good',
    recordedAt: '2026-09-13T20:00:00.000Z',
  };
  const trackLoc = {
    id: 'l2',
    kind: 'track' as const,
    latitude: 47.505,
    longitude: -120.77,
    recordedAt: '2026-09-13T21:00:00.000Z',
  };

  it('ignores uploads after the check-in ended', async () => {
    when('safetyCheckIn.get', [checkInRow({ status: 'safe' })]);
    expect(
      await addLocations({ userId: 'u1', checkInId: 'ci-1', locations: [checkInLoc] }),
    ).toEqual({ accepted: 0 });
    expect(callsFor('safetyCheckIn.insertLocations', 'values')).toHaveLength(0);
  });

  it('drops track points when tracking is off', async () => {
    when('safetyCheckIn.get', [checkInRow({ trackingEnabled: false })]);
    expect(await addLocations({ userId: 'u1', checkInId: 'ci-1', locations: [trackLoc] })).toEqual({
      accepted: 0,
    });

    when('safetyCheckIn.insertLocations', [{ id: 'l1' }]);
    await addLocations({ userId: 'u1', checkInId: 'ci-1', locations: [checkInLoc, trackLoc] });
    const inserted = callsFor('safetyCheckIn.insertLocations', 'values')[0] as { id: string }[];
    expect(inserted.map((r) => r.id)).toEqual(['l1']);
  });

  it('sends each newly stored check-in, oldest first, but not duplicates', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.insertLocations', [{ id: 'l1' }, { id: 'l3' }]);
    const earlier = { ...checkInLoc, id: 'l3', note: null, recordedAt: '2026-09-13T18:00:00.000Z' };
    const dup = { ...checkInLoc, id: 'l4' };

    const result = await addLocations({
      userId: 'u1',
      checkInId: 'ci-1',
      locations: [checkInLoc, earlier, dup, trackLoc],
    });

    expect(result).toEqual({ accepted: 2 });
    const sent = deliveries();
    expect(sent.map((d) => d.operation)).toEqual(['checkIn', 'checkIn']);
    expect(sent[0]?.message.text).toContain('checked in at 11:00 AM near Colchuck Lake.');
    expect(sent[1]?.message.text).toContain('checked in at 1:00 PM near Colchuck Lake. "All good"');
    expect(callsFor('safetyCheckIn.recentLocations', 'limit')).toHaveLength(0);
  });

  it('claims and sends the off-route update when consecutive fixes leave the route', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.insertLocations', [{ id: 'l2' }]);
    when('safetyCheckIn.getTrip', [
      {
        ...trip,
        plannedRoute: [
          { latitude: 47.5, longitude: -120.8 },
          { latitude: 47.51, longitude: -120.8 },
        ],
      },
    ]);
    when('safetyCheckIn.recentLocations', [
      { latitude: 47.506, longitude: -120.77 },
      { latitude: 47.505, longitude: -120.77 },
    ]);
    when('safetyCheckIn.claimOffRoute', [{ id: 'ci-1' }]);

    await addLocations({ userId: 'u1', checkInId: 'ci-1', locations: [trackLoc] });

    expect(callsFor('safetyCheckIn.claimOffRoute', 'set')).toHaveLength(1);
    const sent = deliveries();
    expect(sent.map((d) => d.operation)).toEqual(['offRoute']);
    expect(sent[0]?.message.text).toMatch(
      /^Alex is about 1\.4 mi \(2\.3 km\) off their planned route for Enchantments\./,
    );
  });

  it('does not send when another upload already claimed the off-route update', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.insertLocations', [{ id: 'l2' }]);
    when('safetyCheckIn.getTrip', [
      {
        ...trip,
        plannedRoute: [
          { latitude: 47.5, longitude: -120.8 },
          { latitude: 47.51, longitude: -120.8 },
        ],
      },
    ]);
    when('safetyCheckIn.recentLocations', [
      { latitude: 47.506, longitude: -120.77 },
      { latitude: 47.505, longitude: -120.77 },
    ]);
    when('safetyCheckIn.claimOffRoute', []);

    await addLocations({ userId: 'u1', checkInId: 'ci-1', locations: [trackLoc] });
    expect(mocks.deliverToContacts).toHaveBeenCalledTimes(0);
  });

  it('stays quiet while still on the route', async () => {
    when('safetyCheckIn.get', [checkInRow()]);
    when('safetyCheckIn.insertLocations', [{ id: 'l2' }]);
    when('safetyCheckIn.getTrip', [
      {
        ...trip,
        plannedRoute: [
          { latitude: 47.5, longitude: -120.8 },
          { latitude: 47.51, longitude: -120.8 },
        ],
      },
    ]);
    when('safetyCheckIn.recentLocations', [
      { latitude: 47.505, longitude: -120.8 },
      { latitude: 47.505, longitude: -120.77 },
    ]);

    await addLocations({ userId: 'u1', checkInId: 'ci-1', locations: [trackLoc] });
    expect(callsFor('safetyCheckIn.claimOffRoute', 'set')).toHaveLength(0);
  });
});

describe('getPublicView', () => {
  it('returns null for an unknown or ended token', async () => {
    when('safetyCheckIn.getByToken', []);
    expect(await getPublicView('tok')).toBeNull();
  });

  it('returns null when the trip or user is gone', async () => {
    when('safetyCheckIn.getByToken', [checkInRow()]);
    when('safetyCheckIn.getTripForPage', []);
    expect(await getPublicView('tok')).toBeNull();
  });

  it('includes locations and the pack gear list', async () => {
    when('safetyCheckIn.getByToken', [checkInRow()]);
    when('safetyCheckIn.getTripForPage', [
      { name: 'Enchantments', location: null, packId: 'p1', plannedRoute: null },
    ]);
    when('safetyCheckIn.listLocations', [{ id: 'l1' }]);
    when('safetyCheckIn.listGearForPage', [{ name: 'Stove', quantity: 1 }]);

    const view = await getPublicView('tok');

    expect(view?.userName).toBe('Alex');
    expect(view?.locations).toEqual([{ id: 'l1' }]);
    expect(view?.gear).toEqual([{ name: 'Stove', quantity: 1 }]);
  });

  it('skips the gear query without a linked pack', async () => {
    when('safetyCheckIn.getByToken', [checkInRow()]);
    when('safetyCheckIn.getTripForPage', [{ name: 'T', location: null, packId: null }]);
    when('safetyCheckIn.listLocations', []);

    const view = await getPublicView('tok');

    expect(view?.gear).toEqual([]);
    expect(callsFor('safetyCheckIn.listGearForPage', 'select')).toHaveLength(0);
  });
});
