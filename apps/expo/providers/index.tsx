import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ErrorBoundary } from '~/components/initial/ErrorBoundary';
import '~/utils/polyfills';
import { JotaiProvider } from './JotaiProvider';
import { TanstackProvider } from './TanstackProvider';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';

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
