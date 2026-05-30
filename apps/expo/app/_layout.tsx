import '../polyfills';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import 'expo-app/lib/devClient';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { clientEnvs } from '@packrat/env/expo-client';
import { Alert, type AlertMethods } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { useColorScheme, useInitialAndroidBarSync } from 'expo-app/lib/hooks/useColorScheme';
import { Providers } from 'expo-app/providers';
import { NAV_THEME } from 'expo-app/theme';
import { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';

if (__DEV__ && process.env.EXPO_PUBLIC_DISABLE_LOGBOX === 'true') {
  LogBox.ignoreAllLogs(true);
}

Sentry.init({
  dsn: clientEnvs.EXPO_PUBLIC_SENTRY_DSN,
  enabled: clientEnvs.NODE_ENV !== 'development' && !!clientEnvs.EXPO_PUBLIC_SENTRY_DSN,

  // PII: email, IP, device fingerprint — off by default for GDPR; enable if you have consent.
  sendDefaultPii: false,

  // Sample 20% of sessions for performance; 100% of errors always reach Sentry.
  tracesSampleRate: 0.2,

  // Tag every event with environment so you can filter in the Sentry UI.
  // APP_VARIANT is set per EAS build profile and exposed via app.config.ts extra.
  // Using it instead of NODE_ENV prevents all EAS builds from reporting as 'production'.
  environment: (Constants.expoConfig?.extra?.appVariant as string) ?? 'production',

  // Scrub sensitive query parameters from all HTTP breadcrumbs to prevent token leakage.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.type === 'http' && breadcrumb.data?.url) {
      try {
        const parsed = new URL(String(breadcrumb.data.url));
        const SENSITIVE_PARAMS = ['token', 'access_token', 'auth', 'password', 'jwt', 'session'];
        for (const key of SENSITIVE_PARAMS) {
          if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '[REDACTED]');
        }
        breadcrumb.data.url = parsed.toString();
      } catch {
        // URL parsing failed — leave breadcrumb unchanged
      }
    }
    return breadcrumb;
  },
});

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
