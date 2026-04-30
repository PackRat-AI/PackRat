import '../polyfills';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { Alert, type AlertMethods } from '@packrat-ai/nativewindui';
import { userStore } from 'expo-app/features/auth/store';
import { useColorScheme, useInitialAndroidBarSync } from 'expo-app/lib/hooks/useColorScheme';
import { Providers } from 'expo-app/providers';
import { NAV_THEME } from 'expo-app/theme';
import { useRef } from 'react';

/**
 * Web version of the root layout.
 * Removes native-only imports:
 *   - expo-dev-client (not needed on web)
 *   - @sentry/react-native (use @sentry/nextjs / @sentry/browser for web instead)
 * Metro automatically picks this file over _layout.tsx for web builds.
 */

export {
  ErrorBoundary,
} from 'expo-router';

export let appAlert: React.RefObject<AlertMethods | null>;

function RootLayout() {
  useInitialAndroidBarSync();

  appAlert = useRef<AlertMethods>(null);

  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <Providers>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      <NavThemeProvider value={NAV_THEME[colorScheme]}>
        <Stack screenOptions={SCREEN_OPTIONS}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="auth" />
        </Stack>
        <Alert title="" buttons={[]} ref={appAlert} />
      </NavThemeProvider>
    </Providers>
  );
}

export default RootLayout;

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right',
} as const;
