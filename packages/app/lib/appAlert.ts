import type { AlertMethods } from '@packrat-ai/nativewindui';
import type React from 'react';

// Global alert ref initialized by the Expo app's root layout (_layout.tsx).
// Import and use `appAlert.current?.alert(...)` in package code;
// the shell sets this ref in <RootLayout> so it is always populated at runtime.
export let appAlert: React.RefObject<AlertMethods | null>;

export function setAppAlert(ref: React.RefObject<AlertMethods | null>) {
  appAlert = ref;
}
