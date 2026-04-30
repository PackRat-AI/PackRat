import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';

/**
 * Web version of packingMode store.
 * Uses in-memory observable without persistence (packing mode is session state on web).
 * Metro automatically picks this file over packingMode.ts for web builds.
 */
export const packingModeStore = observable<Record<string, Record<string, boolean>>>({});

// Persist to sessionStorage so state survives tab focus switches but not full refreshes
if (typeof window !== 'undefined') {
  const stored = sessionStorage.getItem('packrat_packing_mode');
  if (stored) {
    try {
      packingModeStore.set(JSON.parse(stored));
    } catch {
      sessionStorage.removeItem('packrat_packing_mode');
    }
  }
}

syncObservable(packingModeStore, {});

export type PackingModeStore = typeof packingModeStore;
