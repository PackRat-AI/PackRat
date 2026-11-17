import { addDays, differenceInCalendarDays, setHours, startOfDay } from 'date-fns';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';

/**
 * Decides which pre-trip reminders a trip gets and writes their copy from the
 * trip's current packing state. Pure, so the countdown and the wording are
 * testable without a notification scheduler. Product behaviour:
 * docs/features/pre-trip-reminders.md.
 */

export const TRIP_REMINDER_ID_PREFIX = 'trip-reminder.';

export type TripReminderMoment = 'weekBefore' | 'threeDaysBefore' | 'eveningBefore' | 'morningOf';

export const TRIP_REMINDER_MOMENTS: readonly TripReminderMoment[] = Object.freeze([
  'weekBefore',
  'threeDaysBefore',
  'eveningBefore',
  'morningOf',
] as const);

/**
 * Local day offset and hour each moment fires at. The 7- and 3-day reminders
 * land mid-morning; the evening-before one leaves time to charge overnight.
 */
const MOMENT_SCHEDULE = Object.freeze({
  weekBefore: { dayOffset: -7, hour: 9 },
  threeDaysBefore: { dayOffset: -3, hour: 9 },
  eveningBefore: { dayOffset: -1, hour: 19 },
  morningOf: { dayOffset: 0, hour: 7 },
} as const);

/** How many names a list spells out before summarising the rest. */
const NAMED_ITEM_LIMIT = 3;

export interface TripReminder {
  identifier: string;
  tripId: string;
  moment: TripReminderMoment;
  fireDate: Date;
  title: string;
  body: string;
}

/** The trip fields reminders read. */
export interface ReminderTrip {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  deleted?: boolean;
  checklist?: { id: string; title: string; done: boolean }[] | null;
}

/** The pack item fields reminders read. */
export interface ReminderPackItem {
  id: string;
  name: string;
  category?: string | null;
  weight?: number | null;
  deleted?: boolean;
}

export type PackProgress =
  | { kind: 'noPack' }
  | { kind: 'empty' }
  | { kind: 'done' }
  | { kind: 'partial'; packed: number; total: number };

export interface PackState {
  progress: PackProgress;
  /** Unpacked item names, most important first. */
  unpacked: string[];
  /** Battery-powered gear in the pack, packed or not — it still needs a charge. */
  chargeable: string[];
  /** The pack carries something to recharge from: a power bank or solar panel. */
  hasFieldPower: boolean;
}

export function reminderIdentifier({
  tripId,
  moment,
}: {
  tripId: string;
  moment: TripReminderMoment;
}): string {
  return `${TRIP_REMINDER_ID_PREFIX}${tripId}.${moment}`;
}

function startDayOf(trip: ReminderTrip): Date | null {
  const start = parseLocalDate(trip.startDate ?? undefined);
  return start ? startOfDay(start) : null;
}

export function fireDateFor({
  moment,
  startDay,
}: {
  moment: TripReminderMoment;
  startDay: Date;
}): Date {
  const { dayOffset, hour } = MOMENT_SCHEDULE[moment];
  return setHours(addDays(startDay, dayOffset), hour);
}

export function tripReminders({
  trip,
  items,
  packedItemIds,
  now,
  conditionsLine,
}: {
  trip: ReminderTrip;
  /** The linked pack's items, or null when the trip has no pack. */
  items: ReminderPackItem[] | null;
  packedItemIds: ReadonlySet<string>;
  now: Date;
  conditionsLine?: string | null;
}): TripReminder[] {
  const startDay = trip.deleted ? null : startDayOf(trip);
  if (!startDay) return [];
  const state = packState({ items, packedItemIds });
  const todo = openChecklistTitles(trip);
  const fieldCharging = fieldChargingTip({ trip, state });

  return TRIP_REMINDER_MOMENTS.flatMap((moment) => {
    const fireDate = fireDateFor({ moment, startDay });
    if (fireDate <= now) return [];
    const { title, body } = reminderCopy({
      moment,
      tripName: trip.name,
      state,
      todo,
      fieldCharging,
      conditions: conditionsLine ?? null,
    });
    return [
      {
        identifier: reminderIdentifier({ tripId: trip.id, moment }),
        tripId: trip.id,
        moment,
        fireDate,
        title,
        body,
      },
    ];
  });
}

/** The readiness summary shows from the first reminder until the start day ends. */
export function isDepartureNear({ trip, now }: { trip: ReminderTrip; now: Date }): boolean {
  const startDay = trip.deleted ? null : startDayOf(trip);
  if (!startDay) return false;
  return now >= addDays(startDay, -7) && now < addDays(startDay, 1);
}

/** Whole days from today to the trip's start day; 0 on the day itself. */
export function daysUntilStart({ trip, now }: { trip: ReminderTrip; now: Date }): number | null {
  const startDay = startDayOf(trip);
  return startDay ? differenceInCalendarDays(startDay, now) : null;
}

// ── Copy ─────────────────────────────────────────────────────────────────────

function reminderCopy({
  moment,
  tripName,
  state,
  todo,
  fieldCharging,
  conditions,
}: {
  moment: TripReminderMoment;
  tripName: string;
  state: PackState;
  todo: string[];
  fieldCharging: string | null;
  conditions: string | null;
}): { title: string; body: string } {
  const base = baseCopy({ moment, tripName, state, todo, fieldCharging });
  // The forecast rides on every reminder but the last: by the morning of, the
  // user is already dressed for it.
  if (moment === 'morningOf' || !conditions) return base;
  return { title: base.title, body: `${base.body} ${conditions}` };
}

function baseCopy({
  moment,
  tripName,
  state,
  todo,
  fieldCharging,
}: {
  moment: TripReminderMoment;
  tripName: string;
  state: PackState;
  todo: string[];
  fieldCharging: string | null;
}): { title: string; body: string } {
  const { progress } = state;
  switch (moment) {
    case 'weekBefore': {
      const body =
        progress.kind === 'noPack'
          ? 'Link a pack to start getting ready.'
          : progress.kind === 'empty'
            ? "Your pack is empty — add what you're bringing."
            : progress.kind === 'done'
              ? "You're all packed already. Nice."
              : `Review your pack — ${progress.packed} of ${progress.total} items packed.`;
      return { title: `${tripName} is next week`, body };
    }
    case 'threeDaysBefore': {
      const body =
        progress.kind === 'noPack'
          ? 'Link a pack so you can start packing.'
          : progress.kind === 'empty'
            ? "Your pack is empty — add what you're bringing."
            : progress.kind === 'done'
              ? "You're all packed."
              : progress.packed === 0
                ? `Time to start packing — ${progress.total} items to go.`
                : `You've packed ${Math.floor((progress.packed * 100) / progress.total)}%. Still to pack: ${listNames(state.unpacked)}.`;
      // Three days out still leaves time to buy or borrow a power bank.
      return {
        title: `${tripName} starts in 3 days`,
        body: [body, fieldCharging].filter(Boolean).join(' '),
      };
    }
    case 'eveningBefore': {
      const lines = [
        progress.kind === 'noPack'
          ? 'Link a pack to run a final check.'
          : progress.kind === 'empty'
            ? 'Your pack is empty.'
            : progress.kind === 'done'
              ? "You're all packed."
              : `Still unpacked: ${listNames(state.unpacked)}.`,
      ];
      if (state.chargeable.length > 0)
        lines.push(`Charge tonight: ${listNames(state.chargeable)}.`);
      if (todo.length > 0) lines.push(`Before you go: ${listNames(todo)}.`);
      return { title: `${tripName} is tomorrow`, body: lines.join(' ') };
    }
    case 'morningOf': {
      const [firstTodo] = todo;
      const [firstUnpacked] = state.unpacked;
      const [firstChargeable] = state.chargeable;
      const body = firstTodo
        ? `Don't forget: ${firstTodo.toLowerCase()}.`
        : firstUnpacked
          ? `Don't forget your ${firstUnpacked.toLowerCase()}!`
          : firstChargeable
            ? `Grab your ${firstChargeable.toLowerCase()} off the charger.`
            : `${tripName} starts today. Enjoy it.`;
      return { title: 'Have a great trip!', body };
    }
  }
}

/** "a, b, c and 4 more" — names the first few, counts the rest. */
export function listNames(names: readonly string[]): string {
  const named = names.slice(0, NAMED_ITEM_LIMIT).map((name) => name.toLowerCase());
  const rest = names.length - named.length;
  if (rest > 0) return `${named.join(', ')} and ${rest} more`;
  if (named.length <= 1) return named[0] ?? '';
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

// ── Field charging ───────────────────────────────────────────────────────────

/** Nights between the start and end days; null without both dates. */
export function tripNights(trip: ReminderTrip): number | null {
  const start = parseLocalDate(trip.startDate ?? undefined);
  const end = parseLocalDate(trip.endDate ?? undefined);
  if (!start || !end) return null;
  return differenceInCalendarDays(end, start);
}

/**
 * A power-bank nudge for a trip of two or more nights that carries gear needing
 * a charge and nothing to charge it from. Sizes follow common backpacking
 * guidance: ~10,000 mAh covers a phone, headlamp and watch for up to 3 nights,
 * ~20,000 mAh for a week; past that, plan a recharge.
 */
export function fieldChargingTip({
  trip,
  state,
}: {
  trip: ReminderTrip;
  state: PackState;
}): string | null {
  if (state.chargeable.length === 0 || state.hasFieldPower) return null;
  const nights = tripNights(trip);
  if (nights === null || nights < 2) return null;
  if (nights <= 3) return `No power bank in your pack — a 10,000 mAh one covers ${nights} nights.`;
  if (nights <= 7) {
    return `No power bank in your pack — bring about 20,000 mAh for ${nights} nights.`;
  }
  return `No power bank in your pack — ${nights} nights needs 20,000 mAh or more, plus a solar panel or a town stop to recharge.`;
}

// ── Before you go ────────────────────────────────────────────────────────────

/** Titles of the trip's Before-you-go tasks not yet ticked off, in list order. */
export function openChecklistTitles(trip: ReminderTrip): string[] {
  return (trip.checklist ?? []).filter((item) => !item.done).map((item) => item.title);
}

/**
 * Common non-gear tasks offered for a trip, minus any already on its list. A
 * campsite booking only applies once the trip runs overnight.
 */
export function checklistSuggestions(trip: ReminderTrip): string[] {
  const suggestions = ['Permit', 'Park pass'];
  const nights = tripNights(trip);
  if (nights !== null && nights > 0) suggestions.push('Campsite reservation');
  suggestions.push('Share your plans with someone');
  const taken = new Set((trip.checklist ?? []).map((item) => item.title.toLowerCase()));
  return suggestions.filter((title) => !taken.has(title.toLowerCase()));
}

// ── Pack state ───────────────────────────────────────────────────────────────

/**
 * Categories that end a trip if forgotten come first: shelter, sleep and water
 * ahead of a spare bandana.
 */
const PRIORITY_CATEGORIES = Object.freeze([
  'shelter',
  'tent',
  'sleep',
  'water',
  'navigation',
  'first aid',
  'cook',
  'food',
  'cloth',
] as const);

const CHARGEABLE_KEYWORDS = Object.freeze([
  'phone',
  'headlamp',
  'flashlight',
  'lantern',
  'gps',
  'power bank',
  'powerbank',
  'battery',
  'camera',
  'inreach',
  'satellite',
  'communicator',
  'watch',
  'radio',
  'speaker',
  'e-reader',
  'kindle',
  'drone',
] as const);

const FIELD_POWER_KEYWORDS = Object.freeze([
  'power bank',
  'powerbank',
  'battery pack',
  'battery bank',
  'portable charger',
  'solar',
] as const);

export function priorityRank(item: ReminderPackItem): number {
  const haystack = `${item.category ?? ''} ${item.name}`.toLowerCase();
  const index = PRIORITY_CATEGORIES.findIndex((keyword) => haystack.includes(keyword));
  return index === -1 ? PRIORITY_CATEGORIES.length : index;
}

export function isFieldPower(item: ReminderPackItem): boolean {
  const name = item.name.toLowerCase();
  return FIELD_POWER_KEYWORDS.some((keyword) => name.includes(keyword));
}

export function isChargeable(item: ReminderPackItem): boolean {
  if (item.category?.toLowerCase().includes('electronic')) return true;
  const name = item.name.toLowerCase();
  return CHARGEABLE_KEYWORDS.some((keyword) => name.includes(keyword));
}

export function packState({
  items,
  packedItemIds,
}: {
  items: ReminderPackItem[] | null;
  packedItemIds: ReadonlySet<string>;
}): PackState {
  if (!items) {
    return { progress: { kind: 'noPack' }, unpacked: [], chargeable: [], hasFieldPower: false };
  }
  const active = items.filter((item) => !item.deleted);
  const remaining = active.filter((item) => !packedItemIds.has(item.id));
  const progress: PackProgress =
    active.length === 0
      ? { kind: 'empty' }
      : remaining.length === 0
        ? { kind: 'done' }
        : { kind: 'partial', packed: active.length - remaining.length, total: active.length };
  const unpacked = [...remaining]
    .sort((a, b) => priorityRank(a) - priorityRank(b) || (b.weight ?? 0) - (a.weight ?? 0))
    .map((item) => item.name);
  return {
    progress,
    unpacked,
    chargeable: active.filter(isChargeable).map((item) => item.name),
    hasFieldPower: active.some(isFieldPower),
  };
}

/** Item ids ticked off in packing mode, from the packing-mode store's record. */
export function packedIdsFrom(record: Record<string, boolean> | null | undefined): Set<string> {
  return new Set(
    Object.entries(record ?? {})
      .filter(([, packed]) => packed)
      .map(([id]) => id),
  );
}
