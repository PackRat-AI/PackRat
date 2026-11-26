import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isDevToolsEnabled } from '../lib/isDevToolsEnabled';

/** Square in the top-right corner, measured below the status bar. */
const CORNER_SIZE = 88;

function openDevTools() {
  router.push('/dev-tools');
}

/**
 * Wraps the app so a one-second hold in the top-right corner opens the
 * developer tools. The gesture's hit area is shrunk to the corner, and it
 * only activates after the hold, so taps on header buttons there still work.
 */
export function DevToolsCornerTrigger({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  if (!isDevToolsEnabled()) return <>{children}</>;

  const longPress = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(1000)
    .hitSlop({ top: 0, right: 0, width: CORNER_SIZE, height: insets.top + CORNER_SIZE })
    .onStart(openDevTools);

  return (
    <GestureDetector gesture={longPress}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
