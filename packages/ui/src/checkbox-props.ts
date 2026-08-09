import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Shared surface for the `checkbox.*` implementations, kept in its own module because a platform
 * file cannot import from its own fallback sibling (`checkbox.android.tsx` importing `./checkbox`
 * resolves back to itself) — same reason as `toggle-props.ts`.
 */
export type CheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Forwarded to the native control. On Android this becomes the `testID` compose modifier, which
   * is what makes the checkbox visible to the accessibility tree at all — without it the control
   * renders as a bare `ComposeView` with no selectable node. See `toggle-props.ts`.
   */
  testID?: string;
};
