import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useRef } from 'react';

export function useBottomSheetAction(sheetRef: React.RefObject<BottomSheetModal | null>) {
  // useRef instead of useState so handleDismiss always reads the latest value.
  // @gorhom/bottom-sheet captures the onDismiss callback reference when the
  // close animation begins — before a setState re-render has been committed.
  // A state-based pending would still be null in that captured closure, causing
  // the action to silently no-op on the first tap and only fire on the second
  // (after the stale render cycle has flushed). A ref is mutated synchronously
  // so the dismiss handler always sees whatever was written by run().
  const pendingRef = useRef<(() => void) | null>(null);

  const run = useCallback(
    (fn: () => void, { defer = true } = {}) => {
      if (!sheetRef.current || !defer) {
        sheetRef.current?.close();
        fn();
        return;
      }
      pendingRef.current = fn;
      sheetRef.current.close();
    },
    [sheetRef],
  );

  const handleDismiss = useCallback(() => {
    const fn = pendingRef.current;
    if (fn) {
      pendingRef.current = null;
      fn();
    }
  }, []);

  return { run, handleDismiss };
}
