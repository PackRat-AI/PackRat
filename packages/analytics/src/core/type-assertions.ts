/**
 * Runtime assertion helpers for narrowing `T | undefined` to `T`.
 *
 * Used to satisfy TypeScript's `noUncheckedIndexedAccess` in hot loops and
 * SQL result iteration where the index is provably within bounds.
 */

export function assertDefined<T>(val: T | undefined, message?: string): asserts val is T {
  if (val === undefined) {
    throw new Error(message ?? 'Value must be defined');
  }
}
