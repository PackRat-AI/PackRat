import type React from 'react';
import { Text, View } from 'react-native';
import { cn } from 'expo-app/lib/cn';

export type ChipVariant = 'default' | 'primary' | 'secondary' | 'outline' | 'worn' | 'consumable';

export interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  className?: string;
  textClassName?: string;
  prefix?: string;
}

export function Chip({
  children,
  variant = 'default',
  className,
  textClassName,
  prefix,
}: ChipProps) {
  return (
    <View
      className={cn(
        'rounded-full px-2 py-1',
        variant === 'default' && 'bg-muted',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'bg-secondary',
        variant === 'outline' && 'border border-border bg-transparent',
        variant === 'worn' && 'bg-emerald-100',
        variant === 'consumable' && 'bg-amber-100',
        className,
      )}
    >
      <Text
        className={cn(
          'text-xs',
          variant === 'default' && 'text-muted-foreground',
          variant === 'primary' && 'text-primary-foreground',
          variant === 'secondary' && 'text-secondary-foreground',
          variant === 'outline' && 'text-foreground',
          variant === 'worn' && 'text-emerald-600',
          variant === 'consumable' && 'text-amber-600',
          textClassName,
        )}
      >
        {prefix ? `${prefix}${children}` : children}
      </Text>
    </View>
  );
}
