import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    createDbClient: vi.fn(() => ({ tag: (label: string) => chain(label) })),
    captureApiException: vi.fn(),
    deliverToContacts: vi.fn(),
    contactsFor: vi.fn(),
    latestLocation: vi.fn(),
  };
});

vi.mock('@packrat/api/db', () => ({ createDbClient: mocks.createDbClient }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));
vi.mock('../delivery', () => ({ deliverToContacts: mocks.deliverToContacts }));
vi.mock('../checkInService', () => ({
  contactsFor: mocks.contactsFor,
  latestLocation: mocks.latestLocation,
  displayName: (u: { firstName: string | null; name: string }) => u.firstName ?? u.name,
  shareUrlFor: (token: string) => `https://api.example.com/api/safety/${token}`,
}));

import { sweepSafetyCheckIns } from '../sweep';

const when = (label: string, ...values: unknown[]) => mocks.results.set(label, values);
const callsFor = (label: string, method: string) =>
  mocks.calls.filter((c) => c.label === label && c.method === method).map((c) => c.args[0]);

const NOW = new Date('2026-09-14T04:30:00.000Z');
const RETURN = new Date('2026-09-14T02:00:00.000Z');
const env = { APNS_BUNDLE_ID: 'world.packrat' } as ValidatedEnv;

const claimed = {
  id: 'ci-1',
  userId: 'u1',
  tripId: 't1',
  shareToken: 'tok',
  expectedReturnAt: RETURN,
  timeZone: 'America/Los_Angeles',
};

beforeEach(() => {
  mocks.results.clear();
  mocks.calls.length = 0;
  vi.clearAllMocks();
  when('safetyCheckIn.claimOverdue', []);
  when('safetyCheckIn.getTrip', [{ name: 'Enchantments' }]);
  when('safetyCheckIn.getUser', [{ name: 'Alex Tester', firstName: 'Alex' }]);
  mocks.contactsFor.mockResolvedValue([{ name: 'Mom', phone: '+1', email: null }]);
  mocks.latestLocation.mockResolvedValue(null);
  mocks.deliverToContacts.mockResolvedValue([]);
});

describe('sweepSafetyCheckIns', () => {
  it('does nothing when no check-in is due', async () => {
    expect(await sweepSafetyCheckIns({ env, now: NOW })).toEqual({ alerted: 0 });
    expect(callsFor('safetyCheckIn.claimOverdue', 'set')[0]).toEqual({ overdueAlertSentAt: NOW });
  });

  it('sends the overdue alert with the last known location', async () => {
    when('safetyCheckIn.claimOverdue', [claimed]);
    mocks.latestLocation.mockResolvedValue({
      latitude: 47.5,
      longitude: -120.8,
      placeName: 'Colchuck Lake',
      recordedAt: new Date('2026-09-13T23:40:00.000Z'),
    });

    expect(await sweepSafetyCheckIns({ env, now: NOW })).toEqual({ alerted: 1 });

    const delivery = mocks.deliverToContacts.mock.calls[0]?.[0];
    expect(delivery.operation).toBe('overdue');
    expect(delivery.contacts).toEqual([{ name: 'Mom', phone: '+1', email: null }]);
    expect(delivery.message.text).toBe(
      'Alex is overdue on Enchantments by 3 hours. Last known location: 4:40 PM near Colchuck Lake. ' +
        'Full gear list and trip details: https://api.example.com/api/safety/tok. Please contact the authorities.',
    );
  });

  it('falls back to generic names when the trip or user is missing', async () => {
    when('safetyCheckIn.claimOverdue', [claimed]);
    when('safetyCheckIn.getTrip', []);
    when('safetyCheckIn.getUser', []);

    await sweepSafetyCheckIns({ env, now: NOW });

    expect(mocks.deliverToContacts.mock.calls[0]?.[0].message.text).toMatch(
      /^Your contact is overdue on their trip by 3 hours\. No location has been shared/,
    );
  });

  it('captures a failed overdue alert', async () => {
    when('safetyCheckIn.claimOverdue', [claimed]);
    mocks.contactsFor.mockRejectedValue(new Error('db down'));

    expect(await sweepSafetyCheckIns({ env, now: NOW })).toEqual({ alerted: 0 });
    expect(mocks.captureApiException.mock.calls[0]?.[0].operation).toBe('safetyCheckIn.overdue');
  });

  it('defaults now to the current time', async () => {
    const result = await sweepSafetyCheckIns({ env });
    expect(result).toEqual({ alerted: 0 });
    const set = callsFor('safetyCheckIn.claimOverdue', 'set')[0] as { overdueAlertSentAt: Date };
    expect(Math.abs(set.overdueAlertSentAt.getTime() - Date.now())).toBeLessThan(5_000);
  });
});
