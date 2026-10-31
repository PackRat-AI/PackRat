import { describe, expect, it } from 'vitest';
import {
  checklistSuggestions,
  daysUntilStart,
  fieldChargingTip,
  fireDateFor,
  isChargeable,
  isDepartureNear,
  isFieldPower,
  listNames,
  openChecklistTitles,
  type PackState,
  packedIdsFrom,
  packState,
  priorityRank,
  type ReminderPackItem,
  type ReminderTrip,
  reminderIdentifier,
  tripNights,
  tripReminders,
} from '../tripReminderPlanner';

const trip = (overrides: Partial<ReminderTrip> = {}): ReminderTrip => ({
  id: 't1',
  name: 'Rainier',
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  ...overrides,
});

const item = ({
  id,
  name,
  ...overrides
}: Pick<ReminderPackItem, 'id' | 'name'> & Partial<ReminderPackItem>) => ({
  id,
  name,
  category: null,
  weight: 0,
  ...overrides,
});

const items = [
  item({ id: 'bandana', name: 'Bandana', weight: 1 }),
  item({ id: 'tent', name: 'Tent', category: 'Shelter', weight: 50 }),
  item({ id: 'headlamp', name: 'Headlamp' }),
  item({ id: 'stove', name: 'Stove', category: 'Cooking', weight: 10 }),
];

const at = (iso: string) => new Date(iso);
const none = new Set<string>();

describe('tripReminders', () => {
  it('schedules all four moments at fixed local hours for a trip a week and more away', () => {
    const reminders = tripReminders({
      trip: trip(),
      items,
      packedItemIds: none,
      now: at('2026-10-01T12:00:00'),
    });
    expect(reminders.map((r) => [r.moment, r.fireDate])).toEqual([
      ['weekBefore', at('2026-10-13T09:00:00')],
      ['threeDaysBefore', at('2026-10-17T09:00:00')],
      ['eveningBefore', at('2026-10-19T19:00:00')],
      ['morningOf', at('2026-10-20T07:00:00')],
    ]);
    expect(reminders[0]?.identifier).toBe('trip-reminder.t1.weekBefore');
    expect(reminders[0]?.tripId).toBe('t1');
  });

  it('skips moments already past instead of sending them late', () => {
    const reminders = tripReminders({
      trip: trip(),
      items,
      packedItemIds: none,
      now: at('2026-10-18T10:00:00'),
    });
    expect(reminders.map((r) => r.moment)).toEqual(['eveningBefore', 'morningOf']);
  });

  it('returns nothing for an undated or deleted trip', () => {
    const now = at('2026-10-01T12:00:00');
    expect(
      tripReminders({ trip: trip({ startDate: null }), items, packedItemIds: none, now }),
    ).toEqual([]);
    expect(
      tripReminders({ trip: trip({ deleted: true }), items, packedItemIds: none, now }),
    ).toEqual([]);
  });

  it('writes partial-progress copy naming the most important unpacked items', () => {
    const [week, three, evening, morning] = tripReminders({
      trip: trip({ endDate: null }),
      items,
      packedItemIds: new Set(['bandana']),
      now: at('2026-10-01T12:00:00'),
    });
    expect(week).toMatchObject({
      title: 'Rainier is next week',
      body: 'Review your pack — 1 of 4 items packed.',
    });
    expect(three).toMatchObject({
      title: 'Rainier starts in 3 days',
      body: "You've packed 25%. Still to pack: tent, stove and headlamp.",
    });
    expect(evening).toMatchObject({
      title: 'Rainier is tomorrow',
      body: 'Still unpacked: tent, stove and headlamp. Charge tonight: headlamp.',
    });
    expect(morning).toMatchObject({ title: 'Have a great trip!', body: "Don't forget your tent!" });
  });

  it('invites starting to pack when nothing is packed yet', () => {
    const [, three] = tripReminders({
      trip: trip({ endDate: null }),
      items,
      packedItemIds: none,
      now: at('2026-10-01T12:00:00'),
    });
    expect(three?.body).toBe('Time to start packing — 4 items to go.');
  });

  it('congratulates a fully packed pack and points at the charger on the morning', () => {
    const reminders = tripReminders({
      trip: trip({ endDate: null }),
      items,
      packedItemIds: new Set(items.map((i) => i.id)),
      now: at('2026-10-01T12:00:00'),
    });
    expect(reminders.map((r) => r.body)).toEqual([
      "You're all packed already. Nice.",
      "You're all packed.",
      "You're all packed. Charge tonight: headlamp.",
      'Grab your headlamp off the charger.',
    ]);
  });

  it('wishes a good trip when there is nothing left to mention', () => {
    const reminders = tripReminders({
      trip: trip(),
      items: [item({ id: 'tent', name: 'Tent' })],
      packedItemIds: new Set(['tent']),
      now: at('2026-10-19T20:00:00'),
    });
    expect(reminders.map((r) => r.body)).toEqual(['Rainier starts today. Enjoy it.']);
  });

  it('asks to link a pack when the trip has none', () => {
    const reminders = tripReminders({
      trip: trip(),
      items: null,
      packedItemIds: none,
      now: at('2026-10-01T12:00:00'),
    });
    expect(reminders.map((r) => r.body)).toEqual([
      'Link a pack to start getting ready.',
      'Link a pack so you can start packing.',
      'Link a pack to run a final check.',
      'Rainier starts today. Enjoy it.',
    ]);
  });

  it('asks to fill an empty pack', () => {
    const reminders = tripReminders({
      trip: trip(),
      items: [],
      packedItemIds: none,
      now: at('2026-10-01T12:00:00'),
    });
    expect(reminders.map((r) => r.body).slice(0, 3)).toEqual([
      "Your pack is empty — add what you're bringing.",
      "Your pack is empty — add what you're bringing.",
      'Your pack is empty.',
    ]);
  });

  it('carries open Before-you-go tasks into the evening and morning reminders', () => {
    const reminders = tripReminders({
      trip: trip({
        checklist: [
          { id: 'a', title: 'Park pass', done: false },
          { id: 'b', title: 'Permit', done: true },
        ],
      }),
      items: [],
      packedItemIds: none,
      now: at('2026-10-19T12:00:00'),
    });
    expect(reminders.map((r) => r.body)).toEqual([
      'Your pack is empty. Before you go: park pass.',
      "Don't forget: park pass.",
    ]);
  });

  it('adds the forecast line to every reminder but the morning-of one', () => {
    const reminders = tripReminders({
      trip: trip(),
      items: null,
      packedItemIds: none,
      now: at('2026-10-01T12:00:00'),
      conditionsLine: 'Rain likely — pack your rain gear.',
    });
    expect(reminders.map((r) => r.body.endsWith('Rain likely — pack your rain gear.'))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('adds the power-bank tip to the three-day reminder', () => {
    const [, three] = tripReminders({
      trip: trip(),
      items: [item({ id: 'phone', name: 'Phone' })],
      packedItemIds: new Set(['phone']),
      now: at('2026-10-01T12:00:00'),
    });
    expect(three?.body).toBe(
      "You're all packed. No power bank in your pack — a 10,000 mAh one covers 2 nights.",
    );
  });
});

describe('isDepartureNear', () => {
  it('opens seven days before the start and closes when the start day ends', () => {
    expect(isDepartureNear({ trip: trip(), now: at('2026-10-12T23:59:00') })).toBe(false);
    expect(isDepartureNear({ trip: trip(), now: at('2026-10-13T00:00:00') })).toBe(true);
    expect(isDepartureNear({ trip: trip(), now: at('2026-10-20T23:59:00') })).toBe(true);
    expect(isDepartureNear({ trip: trip(), now: at('2026-10-21T00:00:00') })).toBe(false);
  });

  it('is false for undated or deleted trips', () => {
    const now = at('2026-10-19T12:00:00');
    expect(isDepartureNear({ trip: trip({ startDate: undefined }), now })).toBe(false);
    expect(isDepartureNear({ trip: trip({ deleted: true }), now })).toBe(false);
  });
});

describe('daysUntilStart', () => {
  it('counts calendar days to the start, zero on the day', () => {
    expect(daysUntilStart({ trip: trip(), now: at('2026-10-17T23:00:00') })).toBe(3);
    expect(daysUntilStart({ trip: trip(), now: at('2026-10-20T08:00:00') })).toBe(0);
    expect(daysUntilStart({ trip: trip({ startDate: null }), now: new Date() })).toBeNull();
  });
});

describe('fireDateFor and reminderIdentifier', () => {
  it('builds the fire date from the start day and the identifier from trip and moment', () => {
    expect(fireDateFor({ moment: 'eveningBefore', startDay: at('2026-03-01T00:00:00') })).toEqual(
      at('2026-02-28T19:00:00'),
    );
    expect(reminderIdentifier({ tripId: 'x', moment: 'morningOf' })).toBe(
      'trip-reminder.x.morningOf',
    );
  });
});

describe('listNames', () => {
  it('names up to three and counts the rest', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Tent'])).toBe('tent');
    expect(listNames(['Tent', 'Stove'])).toBe('tent and stove');
    expect(listNames(['Tent', 'Stove', 'Mug'])).toBe('tent, stove and mug');
    expect(listNames(['Tent', 'Stove', 'Mug', 'Map', 'Hat'])).toBe('tent, stove, mug and 2 more');
  });
});

describe('fieldChargingTip', () => {
  const needsPower: PackState = {
    progress: { kind: 'done' },
    unpacked: [],
    chargeable: ['Phone'],
    hasFieldPower: false,
  };

  it('sizes the power bank to the number of nights', () => {
    const tip = (endDate: string) =>
      fieldChargingTip({ trip: trip({ startDate: '2026-10-01', endDate }), state: needsPower });
    expect(tip('2026-10-02')).toBeNull();
    expect(tip('2026-10-04')).toBe(
      'No power bank in your pack — a 10,000 mAh one covers 3 nights.',
    );
    expect(tip('2026-10-08')).toBe(
      'No power bank in your pack — bring about 20,000 mAh for 7 nights.',
    );
    expect(tip('2026-10-11')).toBe(
      'No power bank in your pack — 10 nights needs 20,000 mAh or more, plus a solar panel or a town stop to recharge.',
    );
  });

  it('stays quiet without chargeable gear, with field power, or without an end date', () => {
    const long = trip({ startDate: '2026-10-01', endDate: '2026-10-05' });
    expect(fieldChargingTip({ trip: long, state: { ...needsPower, chargeable: [] } })).toBeNull();
    expect(
      fieldChargingTip({ trip: long, state: { ...needsPower, hasFieldPower: true } }),
    ).toBeNull();
    expect(fieldChargingTip({ trip: trip({ endDate: null }), state: needsPower })).toBeNull();
  });
});

describe('tripNights', () => {
  it('counts nights between start and end days', () => {
    expect(tripNights(trip())).toBe(2);
    expect(tripNights(trip({ endDate: undefined }))).toBeNull();
  });
});

describe('Before you go', () => {
  it('lists unticked tasks in order', () => {
    expect(
      openChecklistTitles(
        trip({
          checklist: [
            { id: '1', title: 'Permit', done: false },
            { id: '2', title: 'ID', done: true },
            { id: '3', title: 'Park pass', done: false },
          ],
        }),
      ),
    ).toEqual(['Permit', 'Park pass']);
    expect(openChecklistTitles(trip({ checklist: null }))).toEqual([]);
  });

  it('suggests a campsite only for overnight trips and drops tasks already listed', () => {
    expect(checklistSuggestions(trip())).toEqual([
      'Permit',
      'Park pass',
      'Campsite reservation',
      'Share your plans with someone',
    ]);
    expect(
      checklistSuggestions(
        trip({ endDate: '2026-10-20', checklist: [{ id: '1', title: 'permit', done: true }] }),
      ),
    ).toEqual(['Park pass', 'Share your plans with someone']);
    expect(checklistSuggestions(trip({ endDate: null }))).not.toContain('Campsite reservation');
  });
});

describe('packState', () => {
  it('reports no pack, an empty pack, and ignores deleted items', () => {
    expect(packState({ items: null, packedItemIds: none }).progress).toEqual({ kind: 'noPack' });
    expect(
      packState({ items: [item({ id: 'x', name: 'Old', deleted: true })], packedItemIds: none })
        .progress,
    ).toEqual({ kind: 'empty' });
  });

  it('orders unpacked items by priority then weight and finds chargeable gear and field power', () => {
    const state = packState({
      items: [
        ...items,
        item({ id: 'pb', name: 'Anker power bank' }),
        item({ id: 'cam', name: 'GoPro', category: 'Electronics' }),
      ],
      packedItemIds: new Set(['tent']),
    });
    expect(state.progress).toEqual({ kind: 'partial', packed: 1, total: 6 });
    expect(state.unpacked.slice(0, 2)).toEqual(['Stove', 'Bandana']);
    expect(state.chargeable).toEqual(['Headlamp', 'Anker power bank', 'GoPro']);
    expect(state.hasFieldPower).toBe(true);
  });

  it('treats a missing weight as zero when ranking', () => {
    const state = packState({
      items: [
        item({ id: 'a', name: 'Map', weight: null }),
        item({ id: 'b', name: 'Hat', weight: 2 }),
      ],
      packedItemIds: none,
    });
    expect(state.unpacked).toEqual(['Hat', 'Map']);
  });
});

describe('item classifiers', () => {
  it('ranks shelter ahead of uncategorised gear', () => {
    expect(priorityRank(item({ id: 't', name: 'Tent' }))).toBe(1);
    expect(priorityRank(item({ id: 'b', name: 'Bandana' }))).toBe(9);
  });

  it('recognises chargeable gear and field power by name or category', () => {
    expect(isChargeable(item({ id: 'p', name: 'iPhone' }))).toBe(true);
    expect(isChargeable(item({ id: 'c', name: 'Thing', category: 'Electronics' }))).toBe(true);
    expect(isChargeable(item({ id: 's', name: 'Spork' }))).toBe(false);
    expect(isFieldPower(item({ id: 's', name: 'Solar panel' }))).toBe(true);
    expect(isFieldPower(item({ id: 'h', name: 'Headlamp' }))).toBe(false);
  });
});

describe('packedIdsFrom', () => {
  it('keeps only ids ticked true', () => {
    expect([...packedIdsFrom({ a: true, b: false, c: true })]).toEqual(['a', 'c']);
    expect(packedIdsFrom(undefined).size).toBe(0);
  });
});
