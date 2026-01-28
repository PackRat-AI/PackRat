import { View, type ViewProps, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button, type ButtonProps } from './Button';
import { cn } from '../utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ToolbarProps extends ViewProps {
  /**
   * Toolbar title
   */
  title?: string;
  /**
   * Left action buttons
   */
  left?: React.ReactNode;
  /**
   * Right action buttons
   */
  right?: React.ReactNode;
  /**
   * Whether to include safe area
   */
  includeSafeArea?: boolean;
}

export function Toolbar({
  title,
  left,
  right,
  includeSafeArea = true,
  className,
  style,
  ...props
}: ToolbarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn('flex-row items-center justify-between border-b border-border bg-background px-4 py-3', className)}
      style={[
        style,
        includeSafeArea && {
          paddingTop: insets.top + 8,
          paddingBottom: 8,
        },
      ]}
      {...props}
    >
      <View className="flex-row items-center flex-1">
        {left && <View className="mr-2">{left}</View>}
        {title && (
          <Text className="text-lg font-semibold" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      {right && <View className="ml-2 flex-row items-center">{right}</View>}
    </View>
  );
}

export interface ToolbarCTAProps {
  /**
   * CTA button text
   */
  text: string;
  /**
   * CTA button action
   */
  onPress: () => void;
  /**
   * Whether the CTA is disabled
   */
  disabled?: boolean;
}

export function ToolbarCTA({ text, onPress, disabled }: ToolbarCTAProps) {
  return (
    <Button variant="ghost" size="sm" onPress={onPress} disabled={disabled}>
      {text}
    </Button>
  );
}
