/**
 * Narrowing helpers for system boundaries.
 *
 * Two flavours, both named `to*`:
 *
 *  - **Strict narrow**: returns `T | undefined` (`toString`, `toNumber`,
 *    `toBoolean`, `toDate`). The caller decides what to do when the value
 *    doesn't match the type.
 *  - **Coercive narrow**: returns `T` with a safe default (`toArray`,
 *    `toRecord`, `toRecordArray`, `toStringRecord`). Use when the call site
 *    wants to keep working with empty data rather than branch.
 *
 * The legacy `asString` / `asNumber` / `asBoolean` / `asDate` /
 * `asStringRecord` / `asArray` names are kept as aliases for back-compat so
 * existing call sites compile unchanged.
 */

// ── Strict narrow (T | undefined) ─────────────────────────────────────────

/** Returns the value if it's a string, otherwise undefined. */
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentional — paired with toNumber/toBoolean/toDate as the package's narrow-or-undefined API
export const toString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** Returns the value if it's a finite number, otherwise undefined. */
export const toNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Returns the value if it's a boolean, otherwise undefined. */
export const toBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/**
 * Returns the value if it's a bigint, otherwise undefined.
 *
 * Useful for narrowing Postgres `int8` / `bigint` / `COUNT(*)` results — the
 * Neon serverless driver returns those as JS BigInt by default, which throws
 * on `JSON.stringify` without a replacer. Pair with `.toString()` at API
 * boundaries when shipping bigints over JSON.
 */
export const toBigInt = (value: unknown): bigint | undefined =>
  typeof value === 'bigint' ? value : undefined;

/**
 * Returns the value if it's a Date, parses it if it's a string/number,
 * otherwise undefined.
 */
export const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

// ── Coercive narrow (always returns T, with a safe default) ───────────────

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

/**
 * Narrow an unknown value to `Record<string, unknown>` for keyed display, or
 * return `{}` if it isn't a plain object. Use this at API/JSON boundaries
 * where you only need to read string-keyed fields rather than re-validate
 * the full shape with a Zod parser.
 *
 * @example
 * toRecord(unknown)        // { ... } or {}
 * toRecord({ a: 1 }).a     // 1
 */
export const toRecord = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  // safe-cast: guards package internal narrowing — value confirmed non-null, non-array object above
  return value as Record<string, unknown>;
};

/**
 * Narrow an unknown value to `Record<string, unknown>[]` — useful for
 * tabular rendering of API list responses where Treaty's exact element type
 * isn't worth threading through every printTable call site.
 *
 * @example
 * toRecordArray(apiResponse).map(r => ({ id: r.id, name: r.name }))
 */
export const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(toRecord) : [];

/**
 * Returns a `Record<string, string>` from an unknown value, keeping only
 * string-valued entries. Returns `{}` if the input isn't a plain object.
 */
export const toStringRecord = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  // safe-cast: guards package internal narrowing — value is confirmed non-null object by preceding check
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val;
  }
  return out;
};

// ── Back-compat aliases (use the to* name in new code) ─────────────────────

/** @deprecated Use `toString` instead. */
export const asString = toString;
/** @deprecated Use `toNumber` instead. */
export const asNumber = toNumber;
/** @deprecated Use `toBoolean` instead. */
export const asBoolean = toBoolean;
/** @deprecated Use `toDate` instead. */
export const asDate = toDate;
/** @deprecated Use `toStringRecord` instead. */
export const asStringRecord = toStringRecord;
/** @deprecated Use `toArray` instead. */
export const asArray = toArray;

// ── Other utilities ───────────────────────────────────────────────────────

/**
 * Coerces null → undefined for use with `exactOptionalPropertyTypes`
 * stores that only accept `string | undefined`, not `string | null`.
 */
export const nullToUndefined = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;

/**
 * Type-safe indexOf — searches an array for an unknown value and returns its
 * index, or -1 if the value is not a member of the array.
 *
 * Avoids `as ElementType` casts when the call site only has a `string` (or
 * other broad type) but the array is typed as a specific union or tuple.
 *
 * @example
 * safeIndexOf({ array: ['g', 'oz', 'kg', 'lb'], value: field.state.value })  // 0-3 or -1
 */
export const safeIndexOf = <T>({ array, value }: { array: readonly T[]; value: unknown }): number =>
  (array as readonly unknown[]).indexOf(value); // safe-cast: search is read-only; result is a numeric index, no narrowing on T

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

/** Returns true when a string is an absolute HTTP/HTTPS URL. */
export const isRemoteUrl = (value: string): boolean =>
  value.startsWith('http://') || value.startsWith('https://');
