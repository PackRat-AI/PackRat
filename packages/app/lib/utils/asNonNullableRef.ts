/**
 * Safely assert a ref to be non-nullable when the receiving API expects it,
 * but probably handles null internally (e.g. via fallback ref).
 */
export function asNonNullableRef<T>(ref: React.RefObject<T | null>): React.RefObject<T> {
  return ref as React.RefObject<T>;
}
