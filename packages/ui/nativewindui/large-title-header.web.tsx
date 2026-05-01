import { isFunction } from '@packrat/guards';
import type * as React from 'react';
import { useState } from 'react';

import { cn } from './cn.web';
import { SearchInput } from './search-input.web';

export type LargeTitleSearchBarMethods = Record<string, never>;

type HeaderViewProp =
  | React.ReactNode
  | ((props: { tintColor?: string; canGoBack: boolean }) => React.ReactNode);

export interface LargeTitleHeaderProps {
  title?: string;
  leftView?: HeaderViewProp;
  rightView?: HeaderViewProp;
  children?: React.ReactNode;
  backVisible?: boolean;
  searchBar?: {
    ref?: React.RefObject<LargeTitleSearchBarMethods | null>;
    onChangeText?: (text: string) => void;
    content?: React.ReactNode;
    iosHideWhenScrolling?: boolean;
    placeholder?: string;
    testID?: string;
  };
  className?: string;
}

function resolveView(view: HeaderViewProp | undefined): React.ReactNode {
  if (isFunction(view)) return view({ canGoBack: false, tintColor: undefined });
  return view ?? null;
}

export function LargeTitleHeader({
  title,
  leftView,
  rightView,
  children,
  searchBar,
  className,
}: LargeTitleHeaderProps) {
  const [query, setQuery] = useState('');

  const handleSearchChange = (text: string) => {
    setQuery(text);
    searchBar?.onChangeText?.(text);
  };

  return (
    <header className={cn('sticky top-0 z-10 bg-background border-b border-border', className)}>
      <div className="flex items-center justify-between gap-2 px-4 h-14">
        <div className="flex items-center">{resolveView(leftView)}</div>
        {title && <h1 className="text-base font-semibold flex-1 text-center">{title}</h1>}
        <div className="flex items-center">{resolveView(rightView)}</div>
      </div>
      {searchBar && (
        <div className="px-4 pb-2">
          <SearchInput
            value={query}
            onChangeText={handleSearchChange}
            placeholder={searchBar.placeholder ?? 'Search…'}
            testID={searchBar.testID}
          />
        </div>
      )}
      {searchBar?.content && <div className="px-4 pb-2">{searchBar.content}</div>}
      {children}
    </header>
  );
}
