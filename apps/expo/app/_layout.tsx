import '../polyfills';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import 'expo-dev-client';
import { type Href, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { clientEnvs } from '@packrat/env/expo-client';
import { Alert, type AlertMethods } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { userStore } from 'expo-app/features/auth/store';
import { useColorScheme, useInitialAndroidBarSync } from 'expo-app/lib/hooks/useColorScheme';
import { Providers } from 'expo-app/providers';
import { NAV_THEME } from 'expo-app/theme';
import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';

Sentry.init({
  dsn: clientEnvs.EXPO_PUBLIC_SENTRY_DSN,
  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,
});

const user = userStore.peek();
if (user) {
  Sentry.setUser(user);
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export let appAlert: React.RefObject<AlertMethods | null>;

// Watches tokenAtom from OUTSIDE the navigation Stack so that router.replace
// dispatches directly to the root navigator — not to NativeTabs' inner navigator,
// which would silently drop the action on iOS because 'auth' isn't a tab route.
// Rendered inside <Providers> for Jotai context but before <NavThemeProvider><Stack>.
function SignOutGuard() {
  const token = useAtomValue(tokenAtom);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (token) wasAuthenticated.current = true;
  }, [token]);

  useEffect(() => {
    if (!token && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      // safe-cast: '/auth' is a valid root route; Expo Router's Href accepts string paths directly.
      router.replace('/auth' as Href);
    }
  }, [token]);

  return null;
}

function RootLayout() {
  useInitialAndroidBarSync();

  appAlert = useRef<AlertMethods>(null);

  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <Providers>
      <SignOutGuard />
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

export default Sentry.wrap(RootLayout);

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right', // for android
} as const;
