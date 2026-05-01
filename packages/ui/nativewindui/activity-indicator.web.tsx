import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ActivityIndicator({
  size = 'small',
  color,
}: {
  size?: 'small' | 'large';
  color?: string;
}) {
  return (
    <output
      aria-label="Loading"
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        size === 'large' ? 'h-8 w-8' : 'h-4 w-4',
      )}
      style={color ? { color } : undefined}
    />
  );
}
