/**
 * Runtime assertion helpers for narrowing `T | undefined` to `T`.
 *
 * Used to satisfy TypeScript's `noUncheckedIndexedAccess` in hot loops and
 * SQL result iteration where the index is provably within bounds.
 */

export { assertDefined } from '@packrat/guards';
