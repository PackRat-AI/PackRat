// Web fallback — Metro resolves loading-indicator.ios.tsx / .android.tsx on native, so this file
// is only bundled for web, where the SwiftUI / Jetpack Compose views don't exist. It is also the
// base module TypeScript resolves `@packrat/ui/src/loading-indicator` against.
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import {
  ActivityIndicator as RNActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type ActivityIndicatorSize = 'small' | 'large' | number;

type ActivityIndicatorProps = {
  size?: ActivityIndicatorSize;
  color?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

function ActivityIndicator({ size = 'small', color, className, style }: ActivityIndicatorProps) {
  const { colors } = useColorScheme();
  return (
    <RNActivityIndicator
      size={size}
      color={color ?? colors.primary}
      className={className}
      style={style}
    />
  );
}

export { ActivityIndicator };
export type { ActivityIndicatorProps, ActivityIndicatorSize };
