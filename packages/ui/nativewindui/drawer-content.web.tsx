import type { ReactNode } from 'react';
import { cn } from './cn.web';

type DrawerContentRootProps = {
  children?: ReactNode;
  className?: string;
  // Native-only — ignored on web
  navigation?: unknown;
  actions?: ReactNode;
};

export function DrawerContentRoot({ children, className }: DrawerContentRootProps) {
  return <nav className={cn('flex h-full flex-col overflow-y-auto', className)}>{children}</nav>;
}

type DrawerContentSectionTitleProps = {
  children?: ReactNode;
  className?: string;
  type?: 'large' | 'default';
};

export function DrawerContentSectionTitle({
  children,
  className,
  type = 'default',
}: DrawerContentSectionTitleProps) {
  return (
    <p
      className={cn(
        'px-4 pb-2.5 pt-4 font-medium text-card-foreground',
        type === 'large'
          ? 'text-2xl font-bold'
          : 'text-xs uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

type DrawerContentSectionProps = {
  children?: ReactNode;
  className?: string;
};

export function DrawerContentSection({ children, className }: DrawerContentSectionProps) {
  return <ul className={cn('flex flex-col gap-1 px-2', className)}>{children}</ul>;
}

type DrawerContentSectionItemProps = {
  label: string;
  onPress?: () => void;
  isActive?: boolean;
  rightView?: ReactNode;
  // Native-only — icon rendered via Icon shim; omitted on web for simplicity
  icon?: unknown;
};

export function DrawerContentSectionItem({
  label,
  onPress,
  isActive,
  rightView,
}: DrawerContentSectionItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onPress}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-normal transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'text-card-foreground hover:bg-muted',
        )}
      >
        <span className="flex-1">{label}</span>
        {rightView}
      </button>
    </li>
  );
}

// On web there is no react-navigation drawer state; always returns empty string.
export function getActiveDrawerContentScreen(_props?: unknown): string {
  return '';
}
