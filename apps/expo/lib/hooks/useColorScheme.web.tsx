import { COLORS } from 'expo-app/theme/colors';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import * as React from 'react';

/**
 * Web version of useColorScheme.
 * Removes the expo-navigation-bar dependency (Android-only native module).
 * Metro automatically picks this file over useColorScheme.tsx for web builds.
 */
function useColorScheme() {
  const { colorScheme, setColorScheme: setNativeWindColorScheme } = useNativewindColorScheme();

  function setColorScheme(scheme: 'light' | 'dark') {
    setNativeWindColorScheme(scheme);
  }

  function toggleColorScheme() {
    return setColorScheme(colorScheme === 'light' ? 'dark' : 'light');
  }

  return {
    colorScheme: colorScheme ?? 'light',
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
    colors: COLORS[colorScheme ?? 'light'],
  };
}

/**
 * No-op on web — Android navigation bar sync is not needed in the browser.
 */
function useInitialAndroidBarSync() {
  React.useEffect(() => {}, []);
}

export { useColorScheme, useInitialAndroidBarSync };
