import { useImperativeHandle } from 'react';
import { Alert } from 'react-native';
import type { SnackbarHandle, SnackbarProps } from './snackbar-props';

/**
 * Fallback for platforms without the native snackbar (`snackbar.android.tsx`).
 * An informational message needs no UI here; one with an action becomes a
 * two-button alert so the action is still reachable.
 */
function Snackbar({ ref }: SnackbarProps) {
  useImperativeHandle(
    ref,
    (): SnackbarHandle => ({
      show: ({ message, actionLabel }) =>
        new Promise((resolve) => {
          if (!actionLabel) {
            resolve('dismissed');
            return;
          }
          Alert.alert(message, undefined, [
            { text: 'OK', style: 'cancel', onPress: () => resolve('dismissed') },
            { text: actionLabel, onPress: () => resolve('actionPerformed') },
          ]);
        }),
    }),
    [],
  );
  return null;
}

export { Snackbar };
export type { SnackbarHandle, SnackbarProps };
