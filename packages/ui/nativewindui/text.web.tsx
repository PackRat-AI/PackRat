import { type ClassValue, clsx } from 'clsx';
import * as React from 'react';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TextVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'heading'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption1'
  | 'caption2';

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';

const VARIANT_MAP: Record<TextVariant, { el: TextElement; className: string }> = {
  largeTitle: { el: 'h1', className: 'text-3xl font-bold tracking-tight' },
  title1: { el: 'h2', className: 'text-2xl font-bold' },
  title2: { el: 'h3', className: 'text-xl font-semibold' },
  title3: { el: 'h4', className: 'text-lg font-semibold' },
  heading: { el: 'p', className: 'text-base font-semibold' },
  body: { el: 'p', className: 'text-base' },
  callout: { el: 'p', className: 'text-sm' },
  subhead: { el: 'p', className: 'text-sm text-muted-foreground' },
  footnote: { el: 'p', className: 'text-xs text-muted-foreground' },
  caption1: { el: 'span', className: 'text-xs' },
  caption2: { el: 'span', className: 'text-[11px]' },
};

export interface TextProps {
  variant?: TextVariant;
  className?: string;
  children?: React.ReactNode;
  color?: string;
}

export function Text({ variant = 'body', className, children, color: _color }: TextProps) {
  const { el: El, className: variantClass } = VARIANT_MAP[variant] ?? VARIANT_MAP.body;
  return <El className={cn(variantClass, className)}>{children}</El>;
}

export const TextClassContext = React.createContext<string | undefined>(undefined);

export const textVariants = () => '';
