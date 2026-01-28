import { forwardRef } from 'react';
import {
  TextInput,
  type TextInputProps,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';

export interface TextFieldProps extends Omit<TextInputProps, 'placeholder'> {
  /**
   * Optional className for container
   */
  className?: string;
  /**
   * Container className
   */
  containerClassName?: string;
  /**
   * Label for the text field
   */
  label?: string;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Whether to show the character count
   */
  showCount?: boolean;
  /**
   * Maximum character count
   */
  maxLength?: number;
  /**
   * Optional icon on the left
   */
  leftIcon?: React.ReactNode;
  /**
   * Optional icon on the right
   */
  rightIcon?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      showCount,
      maxLength,
      leftIcon,
      rightIcon,
      value,
      ...props
    },
    ref
  ) => {
    return (
      <View className={cn('mb-4', containerClassName)}>
        {label && (
          <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text>
        )}
        <View
          className={cn(
            'flex-row items-center rounded-lg border bg-background px-3 py-3',
            error ? 'border-destructive' : 'border-input',
            props.editable === false && 'opacity-50'
          )}
        >
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <TextInput
            ref={ref}
            className={cn('flex-1 text-base text-foreground h-6', className)}
            value={value}
            maxLength={maxLength}
            {...props}
          />
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
          {showCount && maxLength && (
            <Text className="ml-2 text-sm text-muted-foreground">
              {String(value || '').length}/{maxLength}
            </Text>
          )}
        </View>
        {error && <Text className="mt-1 text-sm text-destructive">{error}</Text>}
      </View>
    );
  }
);

TextField.displayName = 'TextField';
