import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { ErrorBoundary } from 'expo-app/components/initial/ErrorBoundary';
import type { ReactNode } from 'react';
import 'expo-app/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JotaiProvider } from './JotaiProvider';
import { TanstackProvider } from './TanstackProvider';

/**
 * Web version of Providers.
 * Removes native-only providers:
 *   - KeyboardProvider (react-native-keyboard-controller — no web support)
 *   - ActionSheetProvider (@expo/react-native-action-sheet uses React.Children.only which breaks on web)
 * Keeps:
 *   - BottomSheetModalProvider — @gorhom/bottom-sheet 5.x runs on web via
 *     Reanimated + gesture-handler. Screens like PackDetailScreen render
 *     BottomSheetView inline, which subscribes to BottomSheetModalInternalContext
 *     and throws on web without this provider.
 * Metro automatically picks this file over providers/index.tsx for web builds.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <JotaiProvider>
        <TanstackProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
              <PortalHost />
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </TanstackProvider>
      </JotaiProvider>
    </ErrorBoundary>
  );
}
