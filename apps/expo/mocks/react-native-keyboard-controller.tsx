// Web stub for react-native-keyboard-controller.
// On web the software keyboard does not overlay content, so these wrappers
// fall through to their React Native equivalents.
import type React from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

export { KeyboardAvoidingView };

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function KeyboardAwareScrollView({
  children,
  ...props
}: React.ComponentProps<typeof ScrollView>) {
  return <ScrollView {...props}>{children}</ScrollView>;
}

export function KeyboardStickyView({
  children,
  ...props
}: {
  children?: React.ReactNode;
  offset?: { opened?: number; closed?: number };
  [key: string]: unknown;
}) {
  return <View {...(props as object)}>{children}</View>;
}

export function useReanimatedKeyboardAnimation(): { progress: SharedValue<number> } {
  const progress = useSharedValue(0);
  return { progress };
}

export const KeyboardController = {
  dismiss: () => {},
  setFocusTo: () => {},
  addListener: () => ({ remove: () => {} }),
};

export const AndroidSoftInputModes = {};
export const KeyboardEvents = {
  addListener: () => ({ remove: () => {} }),
};
