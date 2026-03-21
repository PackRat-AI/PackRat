import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useState } from 'react';

export function useBottomSheetAction(sheetRef: React.RefObject<BottomSheetModal | null>) {
  const [pending, setPending] = useState<(() => void) | null>(null);

  const run = useCallback(
    (fn: () => void, { defer = true } = {}) => {
      if (!sheetRef.current || !defer) {
        sheetRef.current?.close();
        fn();
        return;
      }
      setPending(() => fn);
      sheetRef.current.close();
    },
    [sheetRef],
  );

  const handleDismiss = useCallback(() => {
    if (pending) {
      const fn = pending;
      setPending(null);
      fn();
    }
  }, [pending]);

  return { run, handleDismiss };
}
