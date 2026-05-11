/**
 * Zod-based parsing helpers.
 *
 * Wraps Zod's safeParse into guard-style functions so call sites
 * don't need to unpack `{ success, data }` everywhere, and so the
 * pattern is consistent across the codebase.
 */
import type { ZodSchema } from 'zod';

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
