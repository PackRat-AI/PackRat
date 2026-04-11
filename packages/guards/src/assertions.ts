/**
 * Assertion helpers. These throw on failure and narrow the type
 * of the caller's variable via `asserts` clauses.
 *
 * Prefer these over non-null assertions (`!`) and `as` casts when
 * you need to tell TypeScript that a value is present/valid.
 */

export function assertDefined<T>(
  value: T | undefined,
  message = 'Value must be defined',
): asserts value is T {
  if (value === undefined) throw new Error(message);
}

export function assertNonNull<T>(
  value: T | null,
  message = 'Value must be non-null',
): asserts value is T {
  if (value === null) throw new Error(message);
}

export function assertPresent<T>(
  value: T | null | undefined,
  message = 'Value must be present',
): asserts value is T {
  if (value === null || value === undefined) throw new Error(message);
}

export function assertIsString(
  value: unknown,
  message = 'Expected a string',
): asserts value is string {
  if (typeof value !== 'string') throw new Error(message);
}

export function assertIsNumber(
  value: unknown,
  message = 'Expected a number',
): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(message);
}

export function assertIsBoolean(
  value: unknown,
  message = 'Expected a boolean',
): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error(message);
}

export function assertAllDefined(
  values: readonly unknown[],
  message = 'All values must be defined',
): void {
  for (let i = 0; i < values.length; i++) {
    if (values[i] === undefined) {
      throw new Error(`${message} (index ${i})`);
    }
  }
}
