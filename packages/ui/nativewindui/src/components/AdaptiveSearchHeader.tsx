import { forwardRef, useRef, useState } from 'react';
import { View, type ViewProps, StyleSheet, Animated } from 'react-native';
import { SearchInput, type SearchInputRef } from './SearchInput';
import { cn } from '../utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AdaptiveSearchHeaderProps extends ViewProps {
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Search callback
   */
  onSearch: (query: string) => void;
  /**
   * Whether the search is loading
   */
  loading?: boolean;
  /**
   * Initial query
   */
  initialQuery?: string;
}

export const AdaptiveSearchHeader = forwardRef<SearchInputRef, AdaptiveSearchHeaderProps>(
  ({ placeholder = 'Search', onSearch, loading, initialQuery = '', className, style, ...props }, ref) => {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState(initialQuery);

    return (
      <View
        className={cn('px-4 pb-2', className)}
        style={[{ paddingTop: insets.top + 8 }, style]}
        {...props}
      >
        <SearchInput
          ref={ref}
          placeholder={placeholder}
          value={query}
          onChangeText={setQuery}
          onSubmit={() => onSearch(query)}
          showIcon={true}
          containerClassName="bg-muted"
        />
      </View>
    );
  }
);

AdaptiveSearchHeader.displayName = 'AdaptiveSearchHeader';
