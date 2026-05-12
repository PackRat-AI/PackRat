import { cn } from 'web-app/lib/utils';

export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-[#0385ff]/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#0385ff] uppercase',
        className,
      )}
    >
      Beta
    </span>
  );
}
