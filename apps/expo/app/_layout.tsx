import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import 'expo-dev-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

import { useColorScheme, useInitialAndroidBarSync } from '~/lib/useColorScheme';
import { Providers } from '~/providers';
import { NAV_THEME } from '~/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
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

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'ios_from_right', // for android
} as const;
