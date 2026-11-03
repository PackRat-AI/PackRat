import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import type { EmergencyContact, IdentifyingGearItem, LocalSafetyCheckIn } from '../types';

/** Choices for how long after the expected return the overdue alert waits. */
export const GRACE_MINUTE_OPTIONS = Object.freeze([60, 120, 180, 240, 360] as const);
export const DEFAULT_GRACE_MINUTES = 120;

/** An hour before the expected return, the user is reminded their contacts are expecting them. */
export const REMINDER_LEAD_MS = 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

function tripDate(value: string | null | undefined): Date | null {
  return parseLocalDate(value ?? undefined);
}

/**
 * Evening of the trip's last day: 7 PM on the end date, or the start date for a one-day trip.
 * Falls back to eight hours from now, rounded up to the quarter hour, when that is under an hour
 * away or the trip has no dates.
 */
export function defaultExpectedReturn({
  trip,
  now,
}: {
  trip: { startDate?: string | null; endDate?: string | null };
  now: Date;
}): Date {
  const lastDay = tripDate(trip.endDate) ?? tripDate(trip.startDate);
  if (lastDay) {
    const evening = new Date(lastDay);
    evening.setHours(19, 0, 0, 0);
    if (evening.getTime() > now.getTime() + HOUR_MS) return evening;
  }
  const fallback = new Date(now.getTime() + 8 * HOUR_MS);
  const roundUp = (15 - (fallback.getMinutes() % 15)) % 15;
  fallback.setMinutes(fallback.getMinutes() + roundUp, 0, 0);
  return fallback;
}

/** Start Trip shows from the trip's start day on, or any time for an undated trip. */
export function canStartTrip({
  trip,
  now,
}: {
  trip: { status?: string | null; startDate?: string | null };
  now: Date;
}): boolean {
  if ((trip.status ?? 'planned') !== 'planned') return false;
  const start = tripDate(trip.startDate);
  if (!start) return true;
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  return startDay.getTime() <= now.getTime();
}

const IDENTIFYING_KINDS: readonly { keywords: readonly string[]; rank: number }[] = Object.freeze([
  { keywords: ['tent', 'shelter', 'tarp', 'bivy', 'hammock'], rank: 0 },
  { keywords: ['jacket', 'shell', 'parka', 'hoodie', 'anorak', 'rain'], rank: 1 },
  { keywords: ['backpack', 'rucksack'], rank: 2 },
  { keywords: ['hat', 'cap', 'beanie'], rank: 3 },
]);

/**
 * Gear someone could spot from a distance (shelter, outer layer, pack, hat), picked from the
 * trip's pack by name and category. One per kind, at most four.
 */
export function identifyingGear(
  items: readonly { name: string; category?: string | null }[],
): IdentifyingGearItem[] {
  const ranked = items.flatMap((item) => {
    const haystack = `${item.name} ${item.category ?? ''}`.toLowerCase();
    const kind = IDENTIFYING_KINDS.find((k) => k.keywords.some((word) => haystack.includes(word)));
    return kind ? [{ item, rank: kind.rank }] : [];
  });
  const seen = new Set<number>();
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .filter(({ rank }) => {
      if (seen.has(rank)) return false;
      seen.add(rank);
      return true;
    })
    .slice(0, 4)
    .map(({ item }) => ({ name: item.name, note: null }));
}

/** Gear with a name, trimmed, as the server accepts it. */
export function cleanGear(gear: readonly IdentifyingGearItem[]): IdentifyingGearItem[] {
  return gear.flatMap((item) => {
    const name = item.name.trim();
    if (!name) return [];
    const note = item.note?.trim() || null;
    return [{ name, note }];
  });
}

/** "orange tent, red rain jacket": what the contacts are told the user is carrying. */
export function carryingText(gear: readonly IdentifyingGearItem[]): string {
  return cleanGear(gear)
    .map(({ name, note }) => (note ? `${note} ${name}` : name))
    .join(', ');
}

export function canBeNotified(contact: Pick<EmergencyContact, 'email'>): boolean {
  return Boolean(contact.email?.trim());
}

/** Something@something.tld; the server does the real validation. */
export function looksLikeEmail(value: string): boolean {
  const parts = value.split('@');
  if (parts.length !== 2 || value.includes(' ')) return false;
  const [local = '', domain = ''] = parts;
  return (
    local.length > 0 && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
  );
}

/**
 * The contacts preselected for a new check-in: the default contact if they can be emailed,
 * otherwise the first contact who can.
 */
export function initialContactIds(contacts: readonly EmergencyContact[]): string[] {
  const reachable = contacts.filter(canBeNotified);
  const pick = reachable.find((c) => c.isDefault) ?? reachable[0];
  return pick ? [pick.id] : [];
}

/** Marks `saved` as the only default when it is one, then inserts or replaces it. */
export function upsertContact({
  contacts,
  saved,
}: {
  contacts: readonly EmergencyContact[];
  saved: EmergencyContact;
}): EmergencyContact[] {
  const cleared = saved.isDefault
    ? contacts.map((c) => (c.isDefault && c.id !== saved.id ? { ...c, isDefault: false } : c))
    : [...contacts];
  const index = cleared.findIndex((c) => c.id === saved.id);
  if (index === -1) return [...cleared, saved];
  cleared[index] = saved;
  return cleared;
}

/** When the contacts get the overdue alert: expected return plus the grace period. */
export function overdueAt(checkIn: Pick<LocalSafetyCheckIn, 'expectedReturnAt' | 'graceMinutes'>) {
  return new Date(new Date(checkIn.expectedReturnAt).getTime() + checkIn.graceMinutes * 60_000);
}

export function contactsNotified(checkIn: Pick<LocalSafetyCheckIn, 'shareUrl'>): boolean {
  return Boolean(checkIn.shareUrl);
}

export function isOverdue({ checkIn, now }: { checkIn: LocalSafetyCheckIn; now: Date }): boolean {
  return Boolean(checkIn.overdueAlertSent) || now.getTime() >= overdueAt(checkIn).getTime();
}

export type Countdown =
  | { kind: 'underMinute' }
  | { kind: 'days'; days: number; hours: number }
  | { kind: 'hours'; hours: number; minutes: number }
  | { kind: 'minutes'; minutes: number };

/** Time left until `target`, in the two largest units worth showing. */
export function countdown({ target, now }: { target: Date; now: Date }): Countdown {
  const minutes = Math.floor((target.getTime() - now.getTime()) / 60_000);
  if (minutes < 1) return { kind: 'underMinute' };
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return { kind: 'days', days, hours };
  if (hours > 0) return { kind: 'hours', hours, minutes: mins };
  return { kind: 'minutes', minutes: mins };
}

export function countdownText(value: Countdown): string | null {
  switch (value.kind) {
    case 'underMinute':
      return null;
    case 'days':
      return `${value.days}d ${value.hours}h`;
    case 'hours':
      return `${value.hours}h ${value.minutes}m`;
    case 'minutes':
      return `${value.minutes}m`;
  }
}

/** The earliest the user may push their return to: later than both now and the current time. */
export function extendedReturn({
  current,
  now,
  hours,
}: {
  current: Date;
  now: Date;
  hours: number;
}): Date {
  return new Date(Math.max(current.getTime(), now.getTime()) + hours * HOUR_MS);
}

export interface PlannedNotification {
  kind: 'reminder' | 'overdue';
  identifier: string;
  fireAt: Date;
}

export const SAFETY_NOTIFICATION_PREFIX = 'safety-';

/**
 * The local notifications for a check-in, skipping any already past: an hour before the expected
 * return, and when the overdue alert goes to the contacts. Local, so they arrive with no signal.
 * The "alert sent" notice waits until the server has the check-in: before that, no one would be
 * alerted, so saying they were would be false.
 */
export function plannedNotifications({
  checkIn,
  now,
}: {
  checkIn: LocalSafetyCheckIn;
  now: Date;
}): PlannedNotification[] {
  const expected = new Date(checkIn.expectedReturnAt).getTime();
  const candidates: PlannedNotification[] = [
    {
      kind: 'reminder',
      identifier: `${SAFETY_NOTIFICATION_PREFIX}reminder-${checkIn.id}`,
      fireAt: new Date(expected - REMINDER_LEAD_MS),
    },
    {
      kind: 'overdue',
      identifier: `${SAFETY_NOTIFICATION_PREFIX}overdue-${checkIn.id}`,
      fireAt: overdueAt(checkIn),
    },
  ];
  return candidates.filter(
    (n) =>
      n.fireAt.getTime() > now.getTime() && (n.kind === 'reminder' || contactsNotified(checkIn)),
  );
}
