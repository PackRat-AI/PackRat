import { describe, expect, it } from 'vitest';
import type { EmergencyContact, LocalSafetyCheckIn } from '../../types';
import {
  canBeNotified,
  canStartTrip,
  carryingText,
  cleanGear,
  contactsNotified,
  countdown,
  countdownText,
  defaultExpectedReturn,
  extendedReturn,
  identifyingGear,
  initialContactIds,
  isOverdue,
  looksLikeEmail,
  overdueAt,
  plannedNotifications,
  upsertContact,
} from '../safetyCheckIn';

function contact(overrides: Partial<EmergencyContact> = {}): EmergencyContact {
  return {
    id: 'c1',
    name: 'Mom',
    phone: null,
    email: 'mom@example.com',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function checkIn(overrides: Partial<LocalSafetyCheckIn> = {}): LocalSafetyCheckIn {
  return {
    id: 'ci1',
    tripId: 't1',
    tripName: 'Enchantments',
    contactNames: ['Mom'],
    expectedReturnAt: new Date(2026, 8, 14, 19, 0).toISOString(),
    graceMinutes: 120,
    trackingEnabled: false,
    startedAt: new Date(2026, 8, 12, 8, 0).toISOString(),
    ...overrides,
  };
}

describe('defaultExpectedReturn', () => {
  it('picks 7 PM on the end date', () => {
    const result = defaultExpectedReturn({
      trip: { startDate: '2026-09-12', endDate: '2026-09-14' },
      now: new Date(2026, 8, 12, 8, 0),
    });
    expect(result).toEqual(new Date(2026, 8, 14, 19, 0, 0, 0));
  });

  it('uses the start date for a one-day trip', () => {
    const result = defaultExpectedReturn({
      trip: { startDate: '2026-09-12' },
      now: new Date(2026, 8, 12, 8, 0),
    });
    expect(result).toEqual(new Date(2026, 8, 12, 19, 0, 0, 0));
  });

  it('falls back to eight hours out, rounded up to the quarter hour, when the evening is near', () => {
    const result = defaultExpectedReturn({
      trip: { startDate: '2026-09-12', endDate: '2026-09-12' },
      now: new Date(2026, 8, 12, 18, 7),
    });
    expect(result).toEqual(new Date(2026, 8, 13, 2, 15, 0, 0));
  });

  it('falls back for an undated trip and keeps a time already on the quarter', () => {
    const result = defaultExpectedReturn({ trip: {}, now: new Date(2026, 8, 12, 9, 30) });
    expect(result).toEqual(new Date(2026, 8, 12, 17, 30, 0, 0));
  });
});

describe('canStartTrip', () => {
  const now = new Date(2026, 8, 12, 6, 0);

  it('allows a planned trip from its start day', () => {
    expect(canStartTrip({ trip: { startDate: '2026-09-12' }, now })).toBe(true);
  });

  it('waits until the start day', () => {
    expect(canStartTrip({ trip: { startDate: '2026-09-13' }, now })).toBe(false);
  });

  it('allows an undated trip any time', () => {
    expect(canStartTrip({ trip: { status: 'planned' }, now })).toBe(true);
  });

  it('never restarts a trip that is underway or done', () => {
    expect(canStartTrip({ trip: { status: 'in_progress' }, now })).toBe(false);
    expect(canStartTrip({ trip: { status: 'complete' }, now })).toBe(false);
  });
});

describe('identifyingGear', () => {
  it('takes one item per kind in spotting order, at most four', () => {
    const result = identifyingGear([
      { name: 'Trekking poles', category: 'Hiking' },
      { name: 'Patagonia Torrentshell', category: 'Clothing - jacket' },
      { name: 'Osprey Exos', category: 'Backpack' },
      { name: 'Big Agnes Copper Spur', category: 'Tent' },
      { name: 'Tarp', category: null },
      { name: 'Sun hat' },
    ]);
    expect(result).toEqual([
      { name: 'Big Agnes Copper Spur', note: null },
      { name: 'Patagonia Torrentshell', note: null },
      { name: 'Osprey Exos', note: null },
      { name: 'Sun hat', note: null },
    ]);
  });

  it('returns nothing for gear no one would spot', () => {
    expect(identifyingGear([{ name: 'Spork', category: 'Kitchen' }])).toEqual([]);
  });
});

describe('gear text', () => {
  it('drops blank items and trims notes', () => {
    expect(
      cleanGear([
        { name: '  tent ', note: ' orange ' },
        { name: '   ', note: 'red' },
        { name: 'jacket', note: '  ' },
      ]),
    ).toEqual([
      { name: 'tent', note: 'orange' },
      { name: 'jacket', note: null },
    ]);
  });

  it('puts the colour before the item', () => {
    expect(
      carryingText([
        { name: 'tent', note: 'orange' },
        { name: 'rain jacket', note: null },
      ]),
    ).toBe('orange tent, rain jacket');
  });
});

describe('contacts', () => {
  it('can notify only contacts with an email address', () => {
    expect(canBeNotified({ email: 'a@b.co' })).toBe(true);
    expect(canBeNotified({ email: '  ' })).toBe(false);
    expect(canBeNotified({ email: null })).toBe(false);
  });

  it.each([
    ['mom@example.com', true],
    ['mom@example', false],
    ['@example.com', false],
    ['mom@.com', false],
    ['mom@example.', false],
    ['mom @example.com', false],
    ['a@b@c.com', false],
  ])('looksLikeEmail(%s) is %s', (value, expected) => {
    expect(looksLikeEmail(value)).toBe(expected);
  });

  it('preselects the default contact when reachable', () => {
    const contacts = [contact({ id: 'a' }), contact({ id: 'b', isDefault: true })];
    expect(initialContactIds(contacts)).toEqual(['b']);
  });

  it('falls back to the first reachable contact', () => {
    const contacts = [
      contact({ id: 'a', email: null, isDefault: true }),
      contact({ id: 'b' }),
      contact({ id: 'c' }),
    ];
    expect(initialContactIds(contacts)).toEqual(['b']);
  });

  it('preselects no one when no contact can be emailed', () => {
    expect(initialContactIds([contact({ email: null })])).toEqual([]);
  });

  it('adds a new contact and keeps only one default', () => {
    const contacts = [contact({ id: 'a', isDefault: true })];
    const result = upsertContact({ contacts, saved: contact({ id: 'b', isDefault: true }) });
    expect(result.map((c) => [c.id, c.isDefault])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('replaces an edited contact in place', () => {
    const contacts = [contact({ id: 'a', isDefault: true }), contact({ id: 'b' })];
    const result = upsertContact({ contacts, saved: contact({ id: 'b', name: 'Dad' }) });
    expect(result.map((c) => [c.id, c.name, c.isDefault])).toEqual([
      ['a', 'Mom', true],
      ['b', 'Dad', false],
    ]);
  });
});

describe('check-in timing', () => {
  it('alerts at the expected return plus grace', () => {
    expect(overdueAt(checkIn())).toEqual(new Date(2026, 8, 14, 21, 0));
  });

  it('knows the contacts were told once there is a share link', () => {
    expect(contactsNotified(checkIn())).toBe(false);
    expect(contactsNotified(checkIn({ shareUrl: 'https://x/api/safety/abc' }))).toBe(true);
  });

  it('is overdue after the alert time or once the server says it sent the alert', () => {
    expect(isOverdue({ checkIn: checkIn(), now: new Date(2026, 8, 14, 20, 59) })).toBe(false);
    expect(isOverdue({ checkIn: checkIn(), now: new Date(2026, 8, 14, 21, 0) })).toBe(true);
    expect(
      isOverdue({ checkIn: checkIn({ overdueAlertSent: true }), now: new Date(2026, 8, 13) }),
    ).toBe(true);
  });

  it('pushes the return back from whichever is later, now or the current time', () => {
    const current = new Date(2026, 8, 14, 19, 0);
    expect(extendedReturn({ current, now: new Date(2026, 8, 14, 15, 0), hours: 2 })).toEqual(
      new Date(2026, 8, 14, 21, 0),
    );
    expect(extendedReturn({ current, now: new Date(2026, 8, 14, 20, 0), hours: 1 })).toEqual(
      new Date(2026, 8, 14, 21, 0),
    );
  });
});

describe('countdown', () => {
  const now = new Date(2026, 8, 14, 12, 0);
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  it.each([
    { minutes: 0.5, expected: { kind: 'underMinute' }, text: null },
    { minutes: 48, expected: { kind: 'minutes', minutes: 48 }, text: '48m' },
    { minutes: 5 * 60 + 12, expected: { kind: 'hours', hours: 5, minutes: 12 }, text: '5h 12m' },
    {
      minutes: 2 * 24 * 60 + 3 * 60 + 40,
      expected: { kind: 'days', days: 2, hours: 3 },
      text: '2d 3h',
    },
  ])('$minutes minutes out', ({ minutes, expected, text }) => {
    const value = countdown({ target: at(minutes), now });
    expect(value).toEqual(expected);
    expect(countdownText(value)).toBe(text);
  });

  it('reads under a minute once past', () => {
    expect(countdown({ target: at(-10), now })).toEqual({ kind: 'underMinute' });
  });
});

describe('plannedNotifications', () => {
  it('reminds an hour before the return and marks the alert time', () => {
    const result = plannedNotifications({ checkIn: checkIn(), now: new Date(2026, 8, 13) });
    expect(result).toEqual([
      {
        kind: 'reminder',
        identifier: 'safety-reminder-ci1',
        fireAt: new Date(2026, 8, 14, 18, 0),
      },
      { kind: 'overdue', identifier: 'safety-overdue-ci1', fireAt: new Date(2026, 8, 14, 21, 0) },
    ]);
  });

  it('skips moments already past', () => {
    const result = plannedNotifications({
      checkIn: checkIn(),
      now: new Date(2026, 8, 14, 18, 30),
    });
    expect(result.map((n) => n.kind)).toEqual(['overdue']);
  });
});
