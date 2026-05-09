'use client';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

export function WeightToggle({ className }: { className?: string }) {
  const { unit, toggleUnit } = useWeight();
  return (
    <button
      type="button"
      onClick={toggleUnit}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-accent',
        className,
      )}
      aria-label={`Switch to ${unit === 'g' ? 'oz' : 'g'}`}
    >
      <span
        className={cn(
          'transition-colors',
          unit === 'g' ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        g
      </span>
      <span className="mx-0.5 text-muted-foreground">/</span>
      <span
        className={cn(
          'transition-colors',
          unit === 'oz' ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        oz
      </span>
    </button>
  );
}
