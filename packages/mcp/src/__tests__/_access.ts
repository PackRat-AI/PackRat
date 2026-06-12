/**
 * Type-safe index/key accessors for tests.
 *
 * Under `noUncheckedIndexedAccess`, `arr[i]` / `record[k]` are `T | undefined`.
 * Rather than bypass the checker with `!` (a non-null assertion that the
 * compiler can't verify), these assert the value is present at runtime and
 * narrow the type to `T` — so a wrong assumption fails loudly with a clear
 * message instead of a downstream `TypeError`, and the type safety stays honest.
 */

/** The element at `index`, or throw if the array is shorter. */
export function nth<T>(items: readonly T[], index: number): T {
  const value = items.at(index);
  if (value === undefined) {
    throw new Error(`nth: no element at index ${index} (length ${items.length})`);
  }
  return value;
}

/** The value for `key`, or throw if the record has no such key. */
export function prop<T>(record: Record<string, T>, key: string): T {
  const value = record[key];
  if (value === undefined) {
    throw new Error(`prop: no value for key "${key}"`);
  }
  return value;
}
