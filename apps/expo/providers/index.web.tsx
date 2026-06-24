import { ActionSheetProvider } from '@expo/react-native-action-sheet';
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
 * Web Providers. Drops KeyboardProvider (no web support); keeps
 * BottomSheetModalProvider for inline BottomSheetView and ActionSheetProvider
 * for useActionSheet(). CustomActionSheet wraps its child in
 * React.Children.only — keep the direct child a single element.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <JotaiProvider>
        <TanstackProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ActionSheetProvider useCustomActionSheet>
                <BottomSheetModalProvider>
                  <>
                    {children}
                    <PortalHost />
                  </>
                </BottomSheetModalProvider>
              </ActionSheetProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </TanstackProvider>
      </JotaiProvider>
    </ErrorBoundary>
  );
}
