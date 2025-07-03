import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import 'expo-dev-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import * as Sentry from '@sentry/react-native';
import { userStore } from '~/features/auth/store';
import { useColorScheme, useInitialAndroidBarSync } from '~/lib/hooks/useColorScheme';
import { Providers } from '~/providers';
import { NAV_THEME } from '~/theme';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
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

function RootLayout() {
  useInitialAndroidBarSync();
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      <Providers>
        <NavThemeProvider value={NAV_THEME[colorScheme]}>
          <Stack screenOptions={SCREEN_OPTIONS}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="auth" />
          </Stack>
        </NavThemeProvider>
      </Providers>
    </>
  );
}

export default Sentry.wrap(RootLayout);

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right', // for android
} as const;
