import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { BottomSheetModalProvider } from '@expo/ui/community/bottom-sheet';
import { ActionSheetHost } from '@packrat/ui/src/action-sheet';
import { AlertHost } from '@packrat/ui/src/alert-host';
import { PortalHost } from '@rn-primitives/portal';
import { ErrorBoundary } from 'expo-app/components/initial/ErrorBoundary';
import 'expo-app/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JotaiProvider } from './JotaiProvider';
import { TanstackProvider } from './TanstackProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <JotaiProvider>
        <TanstackProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <ActionSheetProvider>
                  <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
                </ActionSheetProvider>
                <PortalHost />
                <AlertHost />
                <ActionSheetHost />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </TanstackProvider>
      </JotaiProvider>
    </ErrorBoundary>
  );
}
