import { View, type ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, type TextProps } from './Text';
import { cn } from '../utils';

export interface LargeTitleHeaderProps extends ViewProps {
  /**
   * Title text
   */
  title: string;
  /**
   * Optional subtitle
   */
  subtitle?: string;
  /**
   * Optional action on the right side
   */
  rightAction?: React.ReactNode;
  /**
   * Optional action on the left side
   */
  leftAction?: React.ReactNode;
  /**
   * Whether to include safe area padding
   */
  includeSafeArea?: boolean;
}

export function LargeTitleHeader({
  title,
  subtitle,
  rightAction,
  leftAction,
  includeSafeArea = true,
  className,
  style,
  ...props
}: LargeTitleHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn('pb-2', className)}
      style={[
        style,
        includeSafeArea && {
          paddingTop: insets.top + 8,
          paddingHorizontal: insets.left + 16,
          paddingBottom: 8,
        },
      ]}
      {...props}
    >
      <View className="flex-row items-center justify-between">
        {leftAction && <View>{leftAction}</View>}
        <View className="flex-1">
          <Text className="text-3xl font-bold">{title}</Text>
          {subtitle && <Text className="text-base text-muted-foreground">{subtitle}</Text>}
        </View>
        {rightAction && <View>{rightAction}</View>}
      </View>
    </View>
  );
}
