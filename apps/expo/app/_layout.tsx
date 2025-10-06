import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import 'expo-dev-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { COLORS } from '@packrat-ai/nativewindui';
import * as Sentry from '@sentry/react-native';
import { userStore } from 'expo-app/features/auth/store';
import { useColorScheme, useInitialAndroidBarSync } from 'expo-app/lib/hooks/useColorScheme';
import { Providers } from 'expo-app/providers';
import { NAV_THEME } from 'expo-app/theme';
import type { JSX } from 'react/jsx-runtime';
import { Platform } from 'react-native';
import type { BaseToastProps } from 'react-native-toast-message';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

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

  const inverseColors = COLORS[isDarkColorScheme ? 'light' : 'dark'];

  const toastConfig = {
    success: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
      <BaseToast
        {...props}
        style={{
          borderLeftWidth: 0,
          borderRadius: Platform.OS === 'ios' ? 12 : 4,
          backgroundColor: inverseColors.card,
          marginTop: Platform.OS === 'ios' ? 40 : 0,
          marginHorizontal: 12,
          shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0,
        }}
        contentContainerStyle={{
          paddingHorizontal: 15,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '500',
          color: inverseColors.foreground,
        }}
      />
    ),
    error: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftWidth: 0,
          borderRadius: Platform.OS === 'ios' ? 12 : 4,
          backgroundColor: inverseColors.destructive,
          marginTop: Platform.OS === 'ios' ? 40 : 0,
          marginHorizontal: 12,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '500',
          color: '#fff',
        }}
      />
    ),
  };

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
      <Toast config={toastConfig} position={Platform.OS === 'ios' ? 'top' : 'bottom'} />
    </>
  );
}

export default Sentry.wrap(RootLayout);

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right', // for android
} as const;
