'use client';

import type React from 'react';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedGradientBorderProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  borderWidth?: number;
  duration?: number;
  colors?: string[];
}

export default function AnimatedGradientBorder({
  children,
  className,
  containerClassName,
  borderWidth = 2,
  duration = 8,
  colors = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--primary))'],
}: AnimatedGradientBorderProps) {
  const borderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = borderRef.current;
    if (!element) return;

    // Create gradient with multiple color stops
    const gradientText = `linear-gradient(
      90deg,
      ${colors.join(', ')}
    )`;

    // Set the background image and make it large enough to animate
    element.style.backgroundImage = gradientText;
    element.style.backgroundSize = `${colors.length * 200}% 100%`;

    // Create the animation
    element.animate([{ backgroundPosition: '0% 0%' }, { backgroundPosition: '100% 0%' }], {
      duration: duration * 1000,
      iterations: Number.POSITIVE_INFINITY,
    });
  }, [colors, duration]);

  return (
    <div className={cn('relative', containerClassName)}>
      <div
        ref={borderRef}
        className={cn('absolute inset-0 rounded-xl', className)}
        style={{ padding: borderWidth }}
      >
        <div className="absolute inset-0 rounded-xl bg-background" />
      </div>
      <div className={cn('relative z-10 rounded-xl', `p-[${borderWidth}px]`)}>{children}</div>
    </div>
  );
}
