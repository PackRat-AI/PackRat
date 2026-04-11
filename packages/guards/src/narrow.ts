/**
 * Narrowing helpers that return `T | undefined` instead of throwing.
 *
 * Useful when mapping external data (API responses, unknown records)
 * into strict internal types without `as` casts.
 */

/** Returns the value if it's a string, otherwise undefined. */
export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** Returns the value if it's a finite number, otherwise undefined. */
export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Returns the value if it's a boolean, otherwise undefined. */
export const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/**
 * Coerces null → undefined for use with `exactOptionalPropertyTypes`
 * stores that only accept `string | undefined`, not `string | null`.
 */
export const nullToUndefined = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;

/**
 * Returns the value if it's a Date, parses it if it's a string/number,
 * otherwise undefined.
 */
export const asDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

/**
 * Returns a `Record<string, string>` from an unknown value, keeping only
 * string-valued entries. Returns `{}` if the input isn't a plain object.
 */
export const asStringRecord = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val;
  }
  return out;
};
