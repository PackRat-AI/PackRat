import type React from 'react';
import { cn } from '@/lib/utils';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
}

export default function GradientText({ children, className, gradient }: GradientTextProps) {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent',
        gradient ||
          'bg-gradient-to-r from-primary to-primary/70 dark:from-primary dark:to-primary/70',
        className,
      )}
    >
      {children}
    </span>
  );
}
