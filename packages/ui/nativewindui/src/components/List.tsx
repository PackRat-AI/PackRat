import { forwardRef } from 'react';
import {
  FlatList,
  type FlatListProps,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { cn } from '../utils';

export interface ListDataItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  [key: string]: any;
}

export interface ListProps extends Omit<FlatListProps<ListDataItem>, 'renderItem'> {
  /**
   * Optional className for the list container
   */
  className?: string;
  /**
   * Whether to show separators between items
   */
  showSeparators?: boolean;
  /**
   * Custom item container style
   */
  itemContainerStyle?: ViewStyle;
  /**
   * Custom render function for list items
   */
  renderItem?: (info: { item: ListDataItem; index: number }) => React.ReactNode;
}

export const List = forwardRef<FlatList, ListProps>(
  ({ className, showSeparators, itemContainerStyle, renderItem, ...props }, ref) => {
    const defaultRenderItem = ({ item, index }: { item: ListDataItem; index: number }) => (
      <ListItem
        item={item}
        index={index}
        showSeparator={showSeparators && index > 0}
        style={itemContainerStyle}
      />
    );

    return (
      <FlatList
        ref={ref}
        className={cn('flex-1', className)}
        contentContainerStyle={styles.content}
        keyExtractor={(item) => item.id}
        renderItem={renderItem || defaultRenderItem}
        {...props}
      />
    );
  }
);

List.displayName = 'List';

export interface ListItemProps {
  item: ListDataItem;
  index: number;
  showSeparator?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
}

export function ListItem({ item, showSeparator, style, onPress }: ListItemProps) {
  return (
    <>
      <View
        className={cn(
          'flex-row items-center py-3 pl-3 pr-4',
          onPress && 'active:opacity-70',
          style
        )}
        style={style}
        onPress={onPress}
      >
        {item.icon && <View className="mr-3">{item.icon}</View>}
        <View className="flex-1">
          <Text className="text-base font-medium">{item.title}</Text>
          {item.subtitle && <Text className="text-sm text-muted-foreground">{item.subtitle}</Text>}
        </View>
        {item.trailing && <View className="ml-3">{item.trailing}</View>}
      </View>
      {showSeparator && <View className="ml-12 h-px bg-border" />}
    </>
  );
}

export interface ListSectionHeaderProps {
  title: string;
  className?: string;
}

export function ListSectionHeader({ title, className }: ListSectionHeaderProps) {
  return (
    <View className={cn('px-4 py-2 bg-muted/30', className)}>
      <Text className="text-sm font-semibold uppercase text-muted-foreground">{title}</Text>
    </View>
  );
}
