import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Shared surface for the three `toggle.*` implementations, kept in its own module because a
 * platform file cannot import from its own fallback sibling (`toggle.ios.tsx` importing
 * `./toggle` resolves back to itself).
 *
 * Deliberately the React Native `Switch` subset the call sites already use, so swapping the
 * implementation underneath needs no call-site changes.
 */
/**
 * No `testID`: @expo/ui's `Host` does not accept one on either platform, and accepting it here
 * would mean silently discarding an E2E selector on native. No call site passes one today; if one
 * needs to, wrap the `Toggle` in a `View` that carries the testID.
 */
export type ToggleProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
};
