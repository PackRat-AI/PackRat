import { Badge } from '@packrat/web-ui/components/badge';
import type { ReactNode } from 'react';
import { cn } from './cn.web';

type CardBadgeProps = {
  children?: ReactNode;
  className?: string;
};

export function CardBadge({ children, className }: CardBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'absolute left-0 top-0 z-50 rounded-br-lg rounded-tl-lg rounded-bl-none rounded-tr-none text-xs font-medium tracking-widest uppercase',
        className,
      )}
    >
      {children}
    </Badge>
  );
}

type CardImageProps = {
  source?: { uri?: string } | number;
  className?: string;
  alt?: string;
  // Native-only — ignored on web
  style?: unknown;
  materialRootClassName?: string;
  transition?: number;
  contentPosition?: unknown;
  contentFit?: string;
};

export function CardImage({ source, className, alt = '' }: CardImageProps) {
  const uri =
    typeof source === 'object' && source !== null && 'uri' in source ? source.uri : undefined;
  if (!uri) return null;
  return (
    <img
      src={uri}
      alt={alt}
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
    />
  );
}

type CardSubtitleProps = {
  children?: ReactNode;
  className?: string;
  variant?: string;
};

export function CardSubtitle({ children, className }: CardSubtitleProps) {
  return (
    <p className={cn('text-sm font-medium uppercase opacity-70 text-card-foreground', className)}>
      {children}
    </p>
  );
}
