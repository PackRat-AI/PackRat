import { ProgressView, Host as SwiftUIHost } from '@expo/ui/swift-ui';
import { controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

cssInterop(SwiftUIHost, { className: 'style' });

// swift-ui's Host prop type doesn't extend RN's ViewProps (unlike the universal Host), so
// NativeWind's cssInterop className→style augmentation — which is applied globally to
// ViewProps — never reaches it. cssInterop(Host, { className: 'style' }) above genuinely
// makes className work at runtime; this widened type just tells TS the truth.
type HostProps = ComponentProps<typeof SwiftUIHost> & { className?: string };
const Host = SwiftUIHost as (props: HostProps) => ReturnType<typeof SwiftUIHost>;

type ActivityIndicatorSize = 'small' | 'large' | number;

const SIZE_TO_CONTROL_SIZE: Record<'small' | 'large', 'small' | 'large'> = {
  small: 'small',
  large: 'large',
};

type ActivityIndicatorProps = {
  size?: ActivityIndicatorSize;
  color?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

function resolveControlSize(
  size: ActivityIndicatorSize,
): 'mini' | 'small' | 'regular' | 'large' | 'extraLarge' {
  if (typeof size === 'string') return SIZE_TO_CONTROL_SIZE[size];
  if (size <= 16) return 'mini';
  if (size <= 20) return 'small';
  return 'regular';
}

function ActivityIndicator({ size = 'small', color, className, style }: ActivityIndicatorProps) {
  const { colors } = useColorScheme();
  const resolvedControlSize = resolveControlSize(size);
  return (
    <Host matchContents className={className} style={style}>
      <ProgressView modifiers={[controlSize(resolvedControlSize), tint(color ?? colors.primary)]} />
    </Host>
  );
}

export { ActivityIndicator };
export type { ActivityIndicatorProps, ActivityIndicatorSize };
