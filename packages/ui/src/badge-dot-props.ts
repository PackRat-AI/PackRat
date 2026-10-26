import type { StyleProp, ViewStyle } from 'react-native';

/** Shared surface for the `badge-dot.*` implementations. */
export interface BadgeDotProps {
  /** Mandatory: the native badge is otherwise invisible to E2E and TalkBack. */
  testID: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}
