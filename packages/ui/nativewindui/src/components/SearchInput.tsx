import { forwardRef } from 'react';
import {
  TextInput,
  type TextInputProps,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './Text';
import { cn } from '../utils';
import { Search } from '@expo/vector-icons';

export interface SearchInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

export interface SearchInputProps extends Omit<TextInputProps, 'placeholder'> {
  /**
   * Optional className for container
   */
  className?: string;
  /**
   * Search input container className
   */
  containerClassName?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Optional icon to show on the left
   */
  showIcon?: boolean;
  /**
   * Callback when search is submitted
   */
  onSubmit?: () => void;
}

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(
  (
    {
      className,
      containerClassName,
      placeholder = 'Search',
      showIcon = true,
      onSubmit,
      ...props
    },
    ref
  ) => {
    const handleSubmit = () => {
      onSubmit?.();
    };

    return (
      <View className={cn('flex-row items-center rounded-lg bg-muted px-3 py-2', containerClassName)}>
        {showIcon && (
          <Search size={20} className="mr-2 text-muted-foreground" />
        )}
        <TextInput
          ref={ref as any}
          className={cn('flex-1 text-base text-foreground h-10', className)}
          placeholder={placeholder}
          placeholderTextColor="#6b7280"
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          {...props}
        />
      </View>
    );
  }
);

SearchInput.displayName = 'SearchInput';
