import type React from 'react';

// expo-dev-client enables LogBox error overlays (red popups for console.error/warn).
// Only activate it in debug builds; importing unconditionally causes those overlays
// to surface to end users in preview and production builds.
if (__DEV__) {
  require('expo-dev-client');
}

export function DevClientProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
