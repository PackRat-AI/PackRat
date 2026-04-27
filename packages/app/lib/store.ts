import type { Observable } from '@legendapp/state';
import { assertDefined } from '@packrat/guards';

/**
 * Type-safe accessor for dynamically-keyed Legend-State observable records.
 *
 * @legendapp/state v3 uses JavaScript Proxy to provide deep reactive access
 * via `store[id]`, but TypeScript's static analysis resolves `store[id]` to
 * the plain value type `T` rather than `Observable<T>`. This utility performs
 * the single necessary cast in one documented place, allowing callers to work
 * with the correctly-typed observable without per-call suppressions.
 *
 * @example
 * // Instead of:
 * // @ts-expect-error: Safe because Legend-State uses Proxy
 * packItemsStore[id].deleted.set(true);
 *
 * // Use:
 * obs(packItemsStore, id).deleted.set(true);
 */
export function obs<T>(store: Observable<Record<string, T>>, id: string): Observable<T> {
  // safe-cast: Legend-State v3 uses JavaScript Proxy for deep reactive access via store[id];
  // TypeScript resolves store[id] to T rather than Observable<T>, so we bridge with a single cast.
  const observable = (store as unknown as Record<string, Observable<T>>)[id];
  assertDefined(observable);
  return observable;
}
