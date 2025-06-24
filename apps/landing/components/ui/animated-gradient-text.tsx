'use client';

import type React from 'react';

import { useEffect, useRef } from 'react';
import { cn } from 'landing-app/lib/utils';

interface AnimatedGradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  duration?: number;
  animate?: boolean;
}

export default function AnimatedGradientText({
  children,
  className,
  colors = ['#0F766E', '#14B8A6', '#F97316', '#FB923C'],
  duration = 8,
  animate = true,
}: AnimatedGradientTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!animate || !textRef.current) return;

    const element = textRef.current;

    // Create gradient with multiple color stops
    const gradientText = `linear-gradient(
      to right,
      ${colors[0]} 0%,
      ${colors[1]} 25%,
      ${colors[2]} 50%,
      ${colors[3]} 75%,
      ${colors[0]} 100%
    )`;

    // Set the background image and make it large enough to animate
    element.style.backgroundImage = gradientText;
    element.style.backgroundSize = `${colors.length * 100}% 100%`;

    // Create the animation
    element.animate([{ backgroundPosition: '0% 0%' }, { backgroundPosition: '100% 0%' }], {
      duration: duration * 1000,
      iterations: Number.POSITIVE_INFINITY,
    });
  }, [animate, colors, duration]);

  return (
    <span ref={textRef} className={cn('bg-clip-text text-transparent inline-block', className)}>
      {children}
    </span>
  );
}
