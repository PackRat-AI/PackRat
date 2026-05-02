import type { AlertMethods } from '@packrat/ui/nativewindui';
import type React from 'react';

export let appAlert: React.RefObject<AlertMethods | null>;

export function registerAppAlert(ref: React.RefObject<AlertMethods | null>): void {
  appAlert = ref;
}
