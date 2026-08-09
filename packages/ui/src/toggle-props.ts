import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Shared surface for the three `toggle.*` implementations, kept in its own module because a
 * platform file cannot import from its own fallback sibling (`toggle.ios.tsx` importing
 * `./toggle` resolves back to itself).
 *
 * Deliberately the React Native `Switch` subset the call sites already use, so swapping the
 * implementation underneath needs no call-site changes.
 */
export type ToggleProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * `Host` itself takes no `testID`, but the native control does: on Android via the
   * `testID` compose modifier (moved to modifiers in expo/expo#39155), on iOS via the
   * `testID` prop that SwiftUI views have accepted since expo/expo#37919.
   *
   * Verified on-device on Android: it emits a real node carrying the id with
   * `checkable`/`checked`/`clickable`/`focusable` set, and `checked` tracks state — so it is
   * both a usable E2E selector and correct accessibility semantics.
   */
  testID?: string;
};
