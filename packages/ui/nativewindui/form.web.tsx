import type { ReactNode } from 'react';
import { cn } from './cn.web';

type FormSectionProps = {
  children?: ReactNode;
  title?: string;
  footnote?: string;
  className?: string;
  // Native-only props — ignored on web
  ios?: unknown;
  materialIconProps?: unknown;
};

export function Form({ children }: { children?: ReactNode }) {
  return <form>{children}</form>;
}

export function FormSection({ children, title, footnote, className }: FormSectionProps) {
  return (
    <div className={cn('mb-4', className)}>
      {title && (
        <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card divide-y divide-border">
        {children}
      </div>
      {footnote && <p className="mt-1 px-4 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

type FormItemProps = {
  children?: ReactNode;
  className?: string;
};

export function FormItem({ children, className }: FormItemProps) {
  return (
    <div className={cn('flex flex-row items-center justify-between px-4 py-3', className)}>
      {children}
    </div>
  );
}
