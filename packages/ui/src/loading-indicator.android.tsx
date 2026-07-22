import { Host as JCHost, LoadingIndicator as JCLoadingIndicator } from '@expo/ui/jetpack-compose';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

cssInterop(JCHost, { className: 'style' });

// jetpack-compose's Host prop type doesn't extend RN's ViewProps (unlike the universal Host),
// so NativeWind's cssInterop className→style augmentation — applied globally to ViewProps —
// never reaches it. cssInterop(Host, { className: 'style' }) above genuinely makes className
// work at runtime; this widened type just tells TS the truth.
type HostProps = ComponentProps<typeof JCHost> & { className?: string };
const Host = JCHost as (props: HostProps) => ReturnType<typeof JCHost>;

type ActivityIndicatorSize = 'small' | 'large' | number;

// Material 3 LoadingIndicator has no size prop/modifier — approximate the old
// react-native ActivityIndicator's size classes via the Host box dimensions instead.
const SIZE_PX: Record<'small' | 'large', number> = {
  small: 20,
  large: 36,
};

function resolveSizePx(size: ActivityIndicatorSize): number {
  return typeof size === 'string' ? SIZE_PX[size] : size;
}

type ActivityIndicatorProps = {
  size?: ActivityIndicatorSize;
  color?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

function ActivityIndicator({ size = 'small', color, className, style }: ActivityIndicatorProps) {
  const { colors } = useColorScheme();
  const px = resolveSizePx(size);
  return (
    <Host className={className} style={[{ width: px, height: px }, style]}>
      <JCLoadingIndicator color={color ?? colors.primary} />
    </Host>
  );
}

export { ActivityIndicator };
export type { ActivityIndicatorProps, ActivityIndicatorSize };
