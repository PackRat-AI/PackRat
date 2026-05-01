import { cn } from './cn.web';

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
      aria-live="polite"
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        size === 'large' ? 'h-8 w-8' : 'h-4 w-4',
      )}
      style={color ? { color } : undefined}
    />
  );
}
