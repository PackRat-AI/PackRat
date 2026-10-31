import { addMonths, startOfDay } from 'date-fns';
import { convertToGrams } from '../../packs/utils/convertToGrams';
import { type FinishedTrip, gearKey, type StatsPackItem } from './tripStats';

/**
 * Gear in the user's packs that hasn't come along on a finished trip in the last twelve months.
 * Pure, like the record. Ported from the Swift app's `IdleGear`.
 *
 * PackRat keeps no history of what was in a pack on a given day, so "on a trip" means "in the
 * pack linked to that trip, as the pack is now". An item counts as idle when it has been around
 * for a year (added more than twelve months ago, or on a trip before the window) and no trip
 * inside the window carried it. Consumables aren't gear and are left out. Nothing is judged until
 * at least one finished trip has a pack linked, since without one there's no record of what
 * comes along.
 */

export interface IdleGearPackItem extends StatsPackItem {
  consumable?: boolean;
  category?: string | null;
  weight: number;
  weightUnit: string;
  createdAt?: Date | string | null;
}

export interface IdleGearPack {
  id: string;
  name: string;
  items: readonly IdleGearPackItem[];
  deleted?: boolean;
}

export interface IdleGearLastTrip {
  id: string;
  name: string;
  /** The day the trip ended. */
  date: Date;
}

export interface IdleGearItem {
  /** Same key as the record's top gear: catalog id, else the trimmed name. */
  id: string;
  name: string;
  category: string | null;
  /** Weight of one, in grams. */
  grams: number;
  /** Every pack holding it, by name. */
  packNames: string[];
  /** The pack to open from the list. */
  packId: string;
  /** The most recent finished trip that carried it; null if none ever did. */
  lastTrip: IdleGearLastTrip | null;
}

export interface IdleGear {
  /** Never-taken first, then the longest idle. */
  items: IdleGearItem[];
  /** False when no finished trip has a pack linked: nothing to judge by. */
  isJudgeable: boolean;
  /** The start of the twelve-month window. */
  since: Date;
}

function addedOn(value: IdleGearPackItem['createdAt']): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isGear(item: IdleGearPackItem): boolean {
  return !item.deleted && !item.consumable;
}

export function computeIdleGear({
  finished,
  packs,
  now = new Date(),
}: {
  /** Every finished trip, whatever the scope. */
  finished: readonly FinishedTrip[];
  packs: readonly IdleGearPack[];
  now?: Date;
}): IdleGear {
  const since = addMonths(startOfDay(now), -12);
  const active = packs.filter((pack) => !pack.deleted);
  const packsById = new Map(active.map((pack) => [pack.id, pack]));

  // The latest finished trip each item went on.
  const lastTrip = new Map<string, IdleGearLastTrip>();
  let linkedTrips = 0;
  for (const trip of finished) {
    const pack = trip.trip.packId ? packsById.get(trip.trip.packId) : undefined;
    if (!pack) continue;
    linkedTrips += 1;
    // A trip carries its pack until it ends, so a trip ending inside the window counts.
    const carried = { id: trip.trip.id, name: trip.trip.name, date: trip.end };
    for (const item of pack.items) {
      if (!isGear(item)) continue;
      const key = gearKey(item);
      const known = lastTrip.get(key);
      if (!known || known.date < carried.date) lastTrip.set(key, carried);
    }
  }
  if (linkedTrips === 0) return { items: [], isJudgeable: false, since };

  const inventory = new Map<
    string,
    { item: IdleGearPackItem; packId: string; packNames: string[] }
  >();
  for (const pack of active) {
    for (const item of pack.items) {
      if (!isGear(item)) continue;
      const key = gearKey(item);
      const known = inventory.get(key);
      if (!known) inventory.set(key, { item, packId: pack.id, packNames: [pack.name] });
      else if (!known.packNames.includes(pack.name)) known.packNames.push(pack.name);
    }
  }

  const items = [...inventory.entries()].flatMap(([key, entry]): IdleGearItem[] => {
    const last = lastTrip.get(key) ?? null;
    if (last && last.date >= since) return [];
    // Hasn't had a year to come along yet: added inside the window and never on a trip.
    const added = addedOn(entry.item.createdAt);
    if (!last && added && added > since) return [];
    return [
      {
        id: key,
        name: entry.item.name,
        category: entry.item.category ?? null,
        grams: convertToGrams({ weight: entry.item.weight, unit: entry.item.weightUnit }),
        packNames: entry.packNames,
        packId: entry.packId,
        lastTrip: last,
      },
    ];
  });
  items.sort((a, b) => {
    if (!a.lastTrip && !b.lastTrip) return a.name.localeCompare(b.name);
    if (!a.lastTrip) return -1;
    if (!b.lastTrip) return 1;
    return a.lastTrip.date.getTime() - b.lastTrip.date.getTime() || a.name.localeCompare(b.name);
  });
  return { items, isJudgeable: true, since };
}

export function idleTotalGrams(gear: IdleGear): number {
  return gear.items.reduce((total, item) => total + item.grams, 0);
}
