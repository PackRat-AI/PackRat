/**
 * Zod-based parsing helpers.
 *
 * Wraps Zod's safeParse into guard-style functions so call sites
 * don't need to unpack `{ success, data }` everywhere, and so the
 * pattern is consistent across the codebase.
 */
import { type ZodSchema, z } from 'zod';

/**
 * Returns a parser function `(value: unknown) => T | undefined`.
 * Returns `undefined` if the value fails validation — never throws.
 *
 * @example
 * import { WeightUnitSchema } from '@packrat/api/types';
 * const parseWeightUnit = fromZod(WeightUnitSchema);
 *
 * parseWeightUnit('oz')      // 'oz'
 * parseWeightUnit('stones')  // undefined
 */
export const fromZod =
  <T>(schema: ZodSchema<T>) =>
  (value: unknown): T | undefined => {
    const result = schema.safeParse(value);
    return result.success ? result.data : undefined;
  };

/**
 * Returns a type predicate `(value: unknown) => value is T`.
 * Use when you need a guard rather than a value.
 *
 * @example
 * const isWeightUnit = zodGuard(WeightUnitSchema);
 * if (isWeightUnit(raw)) { ... }
 */
export const zodGuard =
  <T>(schema: ZodSchema<T>) =>
  (value: unknown): value is T =>
    schema.safeParse(value).success;

/**
 * Strict boolean parser for HTTP query strings — `'true' / '1'` → true,
 * `'false' / '0' / ''` → false, anything else fails validation.
 *
 * Why a custom parser: `z.coerce.boolean()` treats every non-empty string as
 * truthy, so `?includeDeleted=false` arrives at the handler as `true`. That
 * silently bypasses ACL filters that gate on "include soft-deleted" flags.
 *
 * @example
 * query: z.object({ includeDeleted: queryBoolean() })
 */
export const queryBoolean = () =>
  z
    .preprocess((v) => {
      if (typeof v === 'boolean') return v;
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0' || v === '' || v === undefined || v === null) return false;
      return v;
    }, z.boolean())
    .optional();
