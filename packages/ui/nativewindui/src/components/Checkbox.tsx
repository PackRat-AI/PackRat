import { View, Pressable, StyleSheet, Text as RNText } from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';
import { forwardRef } from 'react';

export interface CheckboxProps {
  /**
   * Whether the checkbox is checked
   */
  checked: boolean;
  /**
   * Callback when checked state changes
   */
  onChecked: (checked: boolean) => void;
  /**
   * Label text
   */
  label?: string;
  /**
   * Whether the checkbox is disabled
   */
  disabled?: boolean;
  /**
   * Optional className
   */
  className?: string;
}

export function Checkbox({
  checked,
  onChecked,
  label,
  disabled = false,
  className,
}: CheckboxProps) {
  return (
    <Pressable
      className={cn('flex-row items-center', disabled && 'opacity-50', className)}
      onPress={() => !disabled && onChecked(!checked)}
      disabled={disabled}
    >
      <View
        className={cn(
          'h-5 w-5 items-center justify-center rounded border-2',
          checked ? 'border-primary bg-primary' : 'border-input bg-background'
        )}
      >
        {checked && (
          <Text className="text-xs font-bold text-primary-foreground">✓</Text>
        )}
      </View>
      {label && <Text className="ml-2 text-sm">{label}</Text>}
    </Pressable>
  );
}
