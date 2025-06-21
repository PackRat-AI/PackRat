import { cn } from '@/lib/utils';
import type React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export default function GlassCard({ children, className, intensity = 'medium' }: GlassCardProps) {
  // Define backdrop blur intensity
  const blurIntensity = {
    low: 'backdrop-blur-sm',
    medium: 'backdrop-blur-md',
    high: 'backdrop-blur-lg',
  };

  // Define background opacity based on intensity
  const bgOpacity = {
    low: 'bg-background/10 dark:bg-background/10',
    medium: 'bg-background/20 dark:bg-background/20',
    high: 'bg-background/30 dark:bg-background/30',
  };

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-lg',
        blurIntensity[intensity],
        bgOpacity[intensity],
        'border-border/40 dark:border-border/30',
        className
      )}
    >
      {children}
    </div>
  );
}
