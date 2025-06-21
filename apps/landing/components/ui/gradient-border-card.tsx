'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface GradientBorderCardProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  gradientClassName?: string;
  interactive?: boolean;
}

export default function GradientBorderCard({
  children,
  className,
  containerClassName,
  gradientClassName,
  interactive = true,
}: GradientBorderCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !interactive) return;

    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const handleMouseEnter = () => {
    if (!interactive) return;
    setIsHovered(true);
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setIsHovered(false);
    setOpacity(0);
  };

  // Set a default gradient position when not hovered
  useEffect(() => {
    if (!isHovered && interactive) {
      setPosition({ x: 50, y: 50 });
    }
  }, [isHovered, interactive]);

  return (
    <div
      className={cn('relative rounded-xl p-[1px] transition-all duration-300', containerClassName)}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Gradient border */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl opacity-70 transition-opacity duration-300',
          isHovered ? 'opacity-100' : 'opacity-70',
          gradientClassName || 'bg-gradient-to-r from-primary via-secondary to-primary',
        )}
        style={
          {
            background: interactive
              ? `radial-gradient(circle at ${position.x}% ${position.y}%, var(--gradient-start), var(--gradient-end))`
              : undefined,
            opacity: interactive ? opacity : undefined,
            '--gradient-start':
              theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            '--gradient-end': 'transparent',
          } as React.CSSProperties
        }
      />

      {/* Card content */}
      <div
        className={cn(
          'relative z-10 rounded-[10px] bg-card p-6 transition-all duration-300',
          isHovered && interactive ? 'bg-opacity-95' : 'bg-opacity-100',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
