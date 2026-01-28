import {
  Pressable,
  type PressableProps,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text, type TextProps } from './Text';
import { cn } from '../utils';

export interface ButtonProps extends PressableProps {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether the button is loading
   */
  loading?: boolean;
  /**
   * Optional className for additional styling
   */
  className?: string;
  /**
   * Button text props
   */
  textProps?: TextProps;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  textProps,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-center rounded-lg',
        'active:opacity-70',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'bg-secondary',
        variant === 'outline' && 'border border-border bg-transparent',
        variant === 'ghost' && 'bg-transparent',
        variant === 'destructive' && 'bg-destructive',
        size === 'sm' && 'h-8 px-3',
        size === 'md' && 'h-10 px-4',
        size === 'lg' && 'h-12 px-6',
        disabled || loading ? 'opacity-50' : '',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          className="mr-2"
          color={variant === 'primary' ? 'white' : undefined}
          size="small"
        />
      ) : null}
      {typeof children === 'string' ? (
        <Text
          className={cn(
            variant === 'primary' && 'text-primary-foreground',
            variant === 'secondary' && 'text-secondary-foreground',
            variant === 'outline' && 'text-foreground',
            variant === 'ghost' && 'text-foreground',
            variant === 'destructive' && 'text-destructive-foreground',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-base',
            size === 'lg' && 'text-lg'
          )}
          fontWeight="semibold"
          {...textProps}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
