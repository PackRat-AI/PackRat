import { type ClassValue, clsx } from 'clsx';
import type * as React from 'react';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  };
  className?: string;
}

function resolveView(view: HeaderViewProp | undefined): React.ReactNode {
  if (typeof view === 'function') return view({ canGoBack: false, tintColor: undefined });
  return view ?? null;
}

export function LargeTitleHeader({
  title,
  leftView,
  rightView,
  children,
  className,
}: LargeTitleHeaderProps) {
  return (
    <header className={cn('sticky top-0 z-10 bg-background border-b px-4 py-3', className)}>
      <div className="flex items-center justify-between gap-2 h-11">
        <div>{resolveView(leftView)}</div>
        {title && <h1 className="text-xl font-bold flex-1 text-center">{title}</h1>}
        <div>{resolveView(rightView)}</div>
      </div>
      {children}
    </header>
  );
}
