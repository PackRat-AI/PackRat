import { forwardRef } from 'react';
import {
  Switch as RNSwitch,
  type SwitchProps as RNSwitchProps,
  StyleSheet,
  View,
} from 'react-native';
import { cn } from '../utils';

export interface ToggleProps extends Omit<RNSwitchProps, 'value'> {
  /**
   * Whether the toggle is on
   */
  value: boolean;
  /**
   * Optional className for the switch track
   */
  className?: string;
  /**
   * Color variant
   */
  variant?: 'primary' | 'success' | 'destructive';
  /**
   * Size of the toggle
   */
  size?: 'sm' | 'md' | 'lg';
}

export const Toggle = forwardRef<View, ToggleProps>(
  ({ value, className, variant = 'primary', size = 'md', ...props }, ref) => {
    const trackColorMap = {
      primary: { false: '#e5e7eb', true: '#0ea5e9' },
      success: { false: '#e5e7eb', true: '#10b981' },
      destructive: { false: '#e5e7eb', true: '#ef4444' },
    };

    return (
      <RNSwitch
        ref={ref as any}
        className={cn('', className)}
        value={value}
        trackColor={trackColorMap[variant]}
        thumbColor="#ffffff"
        {...props}
      />
    );
  }
);

Toggle.displayName = 'Toggle';
