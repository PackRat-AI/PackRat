import { type ClassValue, clsx } from 'clsx';
import type * as React from 'react';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ListDataItem {
  title: string;
  subTitle?: string;
  [key: string]: unknown;
}

export interface ListItemProps {
  item: ListDataItem;
  leftView?: React.ReactNode;
  rightView?: React.ReactNode;
  onPress?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export interface ListRenderItemInfo<T> {
  item: T;
  index: number;
}

export interface ListProps<T extends ListDataItem = ListDataItem> {
  data?: T[] | null;
  renderItem?: (info: ListRenderItemInfo<T>) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  className?: string;
}

export interface ListRef {
  scrollToIndex: (params: { index: number }) => void;
  scrollToEnd: () => void;
}

export interface ListSectionHeaderProps {
  title: string;
  className?: string;
}

export function ListItem({ item, leftView, rightView, onPress, className }: ListItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent',
        className,
      )}
      onClick={onPress}
    >
      {leftView}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        {item.subTitle && <p className="text-xs text-muted-foreground truncate">{item.subTitle}</p>}
      </div>
      {rightView}
    </button>
  );
}

export function List<T extends ListDataItem = ListDataItem>({
  data,
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  className,
}: ListProps<T>) {
  const items = data ?? [];
  return (
    <div className={cn('flex flex-col', className)}>
      {ListHeaderComponent && <div>{ListHeaderComponent}</div>}
      {items.length === 0 && ListEmptyComponent ? (
        <div>{ListEmptyComponent}</div>
      ) : (
        items.map((item, index) => (
          <div key={keyExtractor ? keyExtractor(item, index) : String(index)}>
            {renderItem?.({ item, index })}
          </div>
        ))
      )}
      {ListFooterComponent && <div>{ListFooterComponent}</div>}
    </div>
  );
}

export function ListSectionHeader({ title, className }: ListSectionHeaderProps) {
  return (
    <div className={cn('px-4 py-2 bg-muted/50', className)}>
      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        {title}
      </p>
    </div>
  );
}

export function getStickyHeaderIndices(_data: unknown[]): number[] {
  return [];
}
