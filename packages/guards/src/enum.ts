/**
 * Helpers for validating string literal unions at runtime.
 *
 * Use these when mapping API responses (`string`) into internal
 * string literal types like `type WeightUnit = 'g' | 'kg' | 'oz' | 'lb'`.
 */

/**
 * Builds a type guard for a string literal union from its members.
 *
 * @example
 * const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb'] as const;
 * type WeightUnit = (typeof WEIGHT_UNITS)[number];
 * const isWeightUnit = makeEnumGuard(WEIGHT_UNITS);
 *
 * if (isWeightUnit(raw)) {
 *   // raw is now narrowed to WeightUnit
 * }
 */
export const makeEnumGuard =
  <T extends string>(members: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (members as readonly string[]).includes(value);

/**
 * Asserts a string belongs to a literal union, throwing otherwise.
 * Narrows the caller's variable via an `asserts` clause.
 */
export function assertEnum<T extends string>(
  value: unknown,
  members: readonly T[],
  name = 'value',
): asserts value is T {
  if (typeof value !== 'string' || !(members as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${name}: expected one of ${members.join(', ')}, got ${String(value)}`);
  }
}
