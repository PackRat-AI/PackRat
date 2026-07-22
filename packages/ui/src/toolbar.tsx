import { Icon } from 'expo-app/components/Icon';
import type { IconProps as ExpoIconProps } from 'expo-app/components/Icon/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { cssInterop } from 'nativewind';
import type * as React from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, type ButtonProps } from './button';
import { Text } from './text';

// Plain RN composition — Toolbar never needed a Host bridge, it already wrapped expo-blur's
// BlurView (an already-installed dependency), not @expo/ui. Ported directly.

cssInterop(BlurView, { className: 'style' });

type ToolbarProps = Omit<ViewProps, 'children' | 'style'> & {
  leftView?: React.ReactNode;
  rightView?: React.ReactNode;
  iosHint?: string;
  iosBlurIntensity?: number;
};

function Toolbar({
  leftView,
  rightView,
  iosHint,
  className,
  iosBlurIntensity = 60,
  ...props
}: ToolbarProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={Platform.select({ ios: iosBlurIntensity, default: 0 })}
      style={{ paddingBottom: insets.bottom + 8 }}
      className={cn(
        'ios:bg-transparent ios:border-t-0 border-border/25 bg-card flex-row items-center justify-between border-t px-4 pt-2.5 dark:border-t-0',
        className,
      )}
      {...props}
    >
      {Platform.OS === 'ios' && !iosHint ? (
        <>
          {leftView}
          {rightView}
        </>
      ) : (
        <>
          <View className="flex-1 flex-row gap-2">{leftView}</View>
          {Platform.OS === 'ios' && !!iosHint && (
            <Text variant="caption2" className="font-medium">
              {iosHint}
            </Text>
          )}
          <View className="flex-1 flex-row justify-end">{rightView}</View>
        </>
      )}
    </BlurView>
  );
}

function ToolbarIcon({
  icon,
  className,
  androidRootClassName,
  ...props
}: ButtonProps & { icon: ExpoIconProps }) {
  const { colors } = useColorScheme();
  return (
    <Button
      size="icon"
      variant="plain"
      className={cn('h-11 w-11 rounded-lg', className)}
      androidRootClassName={cn('rounded-lg', androidRootClassName)}
      {...props}
    >
      <Icon color={Platform.OS === 'ios' ? colors.primary : colors.foreground} {...icon} />
    </Button>
  );
}

function ToolbarCTA({
  icon,
  className,
  androidRootClassName,
  ...props
}: ButtonProps & { icon: ExpoIconProps }) {
  const { colors } = useColorScheme();
  return (
    <Button
      size="icon"
      variant={Platform.select({ ios: 'plain', default: 'tonal' })}
      className={cn('h-11 w-11 rounded-lg', className)}
      androidRootClassName={cn('rounded-lg', androidRootClassName)}
      {...props}
    >
      <Icon
        color={Platform.OS === 'ios' ? colors.primary : colors.foreground}
        size={Platform.OS === 'android' ? 24 : undefined}
        {...icon}
      />
    </Button>
  );
}

export { Toolbar, ToolbarCTA, ToolbarIcon };
