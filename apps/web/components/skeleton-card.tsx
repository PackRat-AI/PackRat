import { cn } from 'web-app/lib/utils';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-2xl bg-card p-4 space-y-3', className)}>
      <div className="h-4 rounded-full bg-muted w-3/4" />
      <div className="h-3 rounded-full bg-muted w-1/2" />
      <div className="h-3 rounded-full bg-muted w-2/3" />
    </div>
  );
}

export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-card">
          <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded-full bg-muted w-3/4" />
            <div className="h-3 rounded-full bg-muted w-1/2" />
          </div>
          <div className="h-3 w-12 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}
