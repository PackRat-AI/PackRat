'use client';

import { Button } from '@packrat/web-ui/components/button';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { cn } from '@packrat/web-ui/lib/utils';
import { ReportCard } from 'admin-app/components/moderation/report-card';
import { reportKey, useFeedReports } from 'admin-app/hooks/use-feed-moderation';
import { RefreshCw, ShieldCheck } from 'lucide-react';

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`skeleton-card-${i}`} className="rounded-lg border border-border/60">
          <div className="flex gap-2 border-b border-border/60 px-4 py-2.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-24 w-24" />
              <Skeleton className="h-24 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-medium">Nothing to review</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        When someone reports a post or comment it shows up here, most-reported first.
      </p>
    </div>
  );
}

export default function ModerationPage() {
  const { data: reports, isLoading, isError, isFetching, refetch } = useFeedReports();
  const count = reports?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Moderation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reported feed posts and comments, most-reported first. Dismiss keeps the item up; remove
            hides it for everyone.
            {count > 0 && (
              <span className="ml-1 font-medium text-foreground">{count} pending.</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {isError ? (
        <p className="py-4 text-sm text-destructive">
          Failed to load reports. Check that the API is reachable.
        </p>
      ) : isLoading ? (
        <QueueSkeleton />
      ) : count === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="space-y-4">
          {reports?.map((report) => (
            <ReportCard key={reportKey(report)} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
