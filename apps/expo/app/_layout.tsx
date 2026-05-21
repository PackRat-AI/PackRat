import '../polyfills';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import 'expo-app/lib/devClient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { clientEnvs } from '@packrat/env/expo-client';
import { Alert, type AlertMethods } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { userStore } from 'expo-app/features/auth/store';
import { useColorScheme, useInitialAndroidBarSync } from 'expo-app/lib/hooks/useColorScheme';
import { Providers } from 'expo-app/providers';
import { NAV_THEME } from 'expo-app/theme';
import { useEffect, useRef } from 'react';

Sentry.init({
  dsn: clientEnvs.EXPO_PUBLIC_SENTRY_DSN,
  enabled: clientEnvs.NODE_ENV !== 'development' && !!clientEnvs.EXPO_PUBLIC_SENTRY_DSN,

  // PII: email, IP, device fingerprint — off by default for GDPR; enable if you have consent.
  sendDefaultPii: false,

  // Sample 20% of sessions for performance; 100% of errors always reach Sentry.
  tracesSampleRate: 0.2,

  // Tag every event with environment so you can filter in the Sentry UI.
  environment: clientEnvs.NODE_ENV ?? 'production',

  // Trim noisy console breadcrumbs in production; keep them in dev.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.type === 'http' && breadcrumb.data?.url) {
      // Strip auth tokens from URLs in breadcrumbs
      const url = String(breadcrumb.data.url);
      if (url.includes('/api/auth/')) return null;
    }
    return breadcrumb;
  },
});

// Sync the authenticated user to Sentry on startup so every event is
// associated with the correct user identity.
const user = userStore.peek();
if (user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: `${user.firstName} ${user.lastName}`.trim(),
  });
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export let appAlert: React.RefObject<AlertMethods | null>;

function RootLayout() {
  useInitialAndroidBarSync();

  appAlert = useRef<AlertMethods>(null);

  const { colorScheme, isDarkColorScheme } = useColorScheme();

  // Sync NativeWind dark mode class to <html> on web (darkMode: 'class' requires it)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDarkColorScheme);
    }
  }, [isDarkColorScheme]);

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

export default Sentry.wrap(RootLayout);

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right', // for android
} as const;
