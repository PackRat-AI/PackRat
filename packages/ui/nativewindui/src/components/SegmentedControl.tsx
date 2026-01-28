import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';

export interface SegmentedControlProps {
  /**
   * Segments to display
   */
  segments: string[];
  /**
   * Currently selected segment index
   */
  selectedIndex: number;
  /**
   * Callback when selection changes
   */
  onChange: (index: number) => void;
  /**
   * Optional className
   */
  className?: string;
  /**
   * Whether the control is disabled
   */
  disabled?: boolean;
}

export function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
  className,
  disabled = false,
}: SegmentedControlProps) {
  return (
    <View
      className={cn(
        'flex-row rounded-lg bg-muted p-1',
        className)
      }
    >
      {segments.map((segment, index) => (
        <Pressable
          key={index}
          className={cn(
            'flex-1 items-center justify-center rounded-md py-2',
            selectedIndex === index && 'bg-background shadow-sm',
            disabled && 'opacity-50'
          )}
          onPress={() => !disabled && onChange(index)}
          disabled={disabled}
        >
          <Text
            className={cn(
              'text-sm font-medium',
              selectedIndex === index ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {segment}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
