import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SegmentedControlProps {
  values: string[];
  selectedIndex?: number;
  onIndexChange?: (index: number) => void;
  enabled?: boolean;
  className?: string;
}

export function SegmentedControl({
  values,
  selectedIndex = 0,
  onIndexChange,
  enabled = true,
  className,
}: SegmentedControlProps) {
  return (
    <div className={cn('flex rounded-md border overflow-hidden', className)}>
      {values.map((value, i) => (
        <button
          key={value}
          type="button"
          disabled={!enabled}
          onClick={() => onIndexChange?.(i)}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
            i === selectedIndex
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-accent',
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
