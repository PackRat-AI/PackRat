import { View, type ViewProps, StyleSheet } from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';

export interface BadgeProps extends ViewProps {
  /**
   * Badge variant
   */
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning';
  /**
   * Badge size
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Text content
   */
  children: React.ReactNode;
}

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        variant === 'default' && 'bg-primary',
        variant === 'secondary' && 'bg-secondary',
        variant === 'destructive' && 'bg-destructive',
        variant === 'success' && 'bg-emerald-500',
        variant === 'warning' && 'bg-amber-500',
        size === 'sm' && 'px-2 py-0.5',
        size === 'md' && 'px-3 py-1',
        size === 'lg' && 'px-4 py-1.5',
        className
      )}
      {...props}
    >
      <Text
        className={cn(
          'font-medium',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base',
          variant === 'default' && 'text-primary-foreground',
          variant === 'secondary' && 'text-secondary-foreground',
          variant === 'destructive' && 'text-destructive-foreground',
          variant === 'success' && 'text-white',
          variant === 'warning' && 'text-white'
        )}
      >
        {children}
      </Text>
    </View>
  );
}
