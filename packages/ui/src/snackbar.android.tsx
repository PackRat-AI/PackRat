import {
  Host,
  Snackbar as JCSnackbar,
  SnackbarHost as JCSnackbarHost,
  type SnackbarHostRef,
} from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import type { SnackbarHandle, SnackbarProps } from './snackbar-props';

// Tall enough for a one-line M3 snackbar plus its 12dp margins.
const SNACKBAR_SLOT_HEIGHT = 80;

/**
 * Material 3 snackbar, rendered by Compose's `SnackbarHost`.
 *
 * Mount once at the bottom of a screen and call `ref.show(...)`. The native
 * host only takes up space while a snackbar is on screen, so it never sits
 * over (and swallows taps meant for) the content beneath it.
 */
function Snackbar({ ref, testID, bottomOffset = 0 }: SnackbarProps) {
  const hostRef = useRef<SnackbarHostRef>(null);
  const [showing, setShowing] = useState(0);

  useImperativeHandle(
    ref,
    (): SnackbarHandle => ({
      show: async ({ message, actionLabel }) => {
        setShowing((count) => count + 1);
        try {
          // Compose keeps an action snackbar up indefinitely by default; M3 wants
          // it to time out like any other, just with longer to reach the action.
          const result = await hostRef.current?.showSnackbar({
            message,
            actionLabel,
            duration: actionLabel ? 'long' : 'short',
          });
          return result ?? 'dismissed';
        } finally {
          setShowing((count) => count - 1);
        }
      },
    }),
    [],
  );

  return (
    <View
      pointerEvents={showing > 0 ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        height: showing > 0 ? SNACKBAR_SLOT_HEIGHT : 0,
      }}
    >
      <Host style={{ flex: 1 }}>
        <JCSnackbarHost ref={hostRef} modifiers={[testIDModifier(testID)]}>
          <JCSnackbar />
        </JCSnackbarHost>
      </Host>
    </View>
  );
}

export { Snackbar };
export type { SnackbarHandle, SnackbarProps };
