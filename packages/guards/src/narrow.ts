/**
 * Narrowing helpers that return `T | undefined` instead of throwing,
 * and coercion helpers that massage values into well-typed shapes.
 *
 * Use these at system boundaries (API responses, CSV rows, unknown records)
 * instead of `as` casts.
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
  // TypeScript requires an explicit cast here; value is narrowed to object by the check above.
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val;
  }
  return out;
};

/**
 * Wraps a single value in an array if it isn't one already.
 * Useful for normalising API fields that can be `T | T[]`.
 *
 * @example
 * toArray('foo')       // ['foo']
 * toArray(['foo'])     // ['foo']
 * toArray(undefined)   // []
 */
export const toArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

/** Alias for toArray — prefer whichever reads more clearly at the call site. */
export const asArray = toArray;

/**
 * Filters nullish values out of an array and narrows the element type.
 *
 * @example
 * compact([1, null, 2, undefined])  // [1, 2]  typed as number[]
 */
export const compact = <T>(arr: (T | null | undefined)[]): T[] =>
  arr.filter((v): v is T => v !== null && v !== undefined);

/**
 * Returns the first non-nullish value from a list of candidates.
 *
 * @example
 * firstDefined(undefined, null, 'hello', 'world')  // 'hello'
 */
export const firstDefined = <T>(...values: (T | null | undefined)[]): T | undefined =>
  values.find((v): v is T => v !== null && v !== undefined);
