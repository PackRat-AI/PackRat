import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { ErrorBoundary } from 'expo-app/components/initial/ErrorBoundary';
import 'expo-app/utils/polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { JotaiProvider } from './JotaiProvider';
import { TanstackProvider } from './TanstackProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <JotaiProvider>
        <TanstackProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ActionSheetProvider>
                <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
              </ActionSheetProvider>
              <PortalHost />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </TanstackProvider>
      </JotaiProvider>
    </ErrorBoundary>
  );
}
