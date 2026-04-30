import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { ErrorBoundary } from 'expo-app/components/initial/ErrorBoundary';
import 'expo-app/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JotaiProvider } from './JotaiProvider';
import { TanstackProvider } from './TanstackProvider';

/**
 * Web version of Providers.
 * Removes native-only providers:
 *   - KeyboardProvider (react-native-keyboard-controller — no web support)
 *   - BottomSheetModalProvider (@gorhom/bottom-sheet — native module dependency)
 * Metro automatically picks this file over providers/index.tsx for web builds.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <JotaiProvider>
        <TanstackProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ActionSheetProvider>{children}</ActionSheetProvider>
              <PortalHost />
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </TanstackProvider>
      </JotaiProvider>
    </ErrorBoundary>
  );
}
