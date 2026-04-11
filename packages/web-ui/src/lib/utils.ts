import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Narrows `T | undefined` to `T` by throwing if the value is undefined.
 * Used by components that access collections under `noUncheckedIndexedAccess`
 * (e.g. input-otp slot indexing).
 */
export function assertDefined<T>(val: T | undefined): asserts val is T {
  if (val === undefined) throw new Error('Value must be defined');
}
