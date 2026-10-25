/**
 * Legend-State's local cache revives every full ISO timestamp as a `Date` when it loads, so trip
 * dates come back as objects even though the store types them as strings. This turns them back
 * into ISO strings, for each trip in the cached table.
 */
export function restoreTripDateStrings<T extends object>(trips: Record<string, T>) {
  for (const trip of Object.values(trips)) {
    if (!trip) continue;
    const fields = trip as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields)) {
      if (value instanceof Date) fields[key] = value.toISOString();
    }
  }
  return trips;
}
