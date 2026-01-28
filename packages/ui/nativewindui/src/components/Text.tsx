import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { cn } from '../utils';

export interface TextProps extends RNTextProps {
  /**
   * Optional className for additional styling
   */
  className?: string;
  /**
   * Color variant
   */
  variant?: 'primary' | 'secondary' | 'muted' | 'error' | 'success';
}

export function Text({ className, variant = 'primary', style, ...props }: TextProps) {
  return (
    <RNText
      className={cn(
        variant === 'primary' && 'text-foreground',
        variant === 'secondary' && 'text-secondary-foreground',
        variant === 'muted' && 'text-muted-foreground',
        variant === 'error' && 'text-destructive',
        variant === 'success' && 'text-emerald-500',
        className
      )}
      style={[styles.text, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    // Base styles handled by nativewind classes
  },
});
