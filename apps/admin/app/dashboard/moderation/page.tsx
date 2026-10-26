'use client';

import { Button } from '@packrat/web-ui/components/button';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { cn } from '@packrat/web-ui/lib/utils';
import { AiReportCard } from 'admin-app/components/moderation/ai-report-card';
import { ReportCard } from 'admin-app/components/moderation/report-card';
import { TrailFlagCard } from 'admin-app/components/moderation/trail-flag-card';
import { useAiReports } from 'admin-app/hooks/use-ai-moderation';
import { reportKey, useFeedReports } from 'admin-app/hooks/use-feed-moderation';
import { useTrailFlags } from 'admin-app/hooks/use-trail-moderation';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type React from 'react';

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

function EmptyQueue({ description }: { description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-medium">Nothing to review</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function QueueSection({
  title,
  count,
  isLoading,
  isError,
  emptyDescription,
  children,
}: {
  title: string;
  count: number;
  isLoading: boolean;
  isError: boolean;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">
        {title}
        {count > 0 && <span className="ml-1.5 text-muted-foreground">{count}</span>}
      </h3>
      {isError ? (
        <p className="py-4 text-sm text-destructive">
          Failed to load. Check that the API is reachable.
        </p>
      ) : isLoading ? (
        <QueueSkeleton />
      ) : count === 0 ? (
        <EmptyQueue description={emptyDescription} />
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </section>
  );
}

export default function ModerationPage() {
  const feed = useFeedReports();
  const trail = useTrailFlags();
  const feedCount = feed.data?.length ?? 0;
  const ai = useAiReports();
  const trailCount = trail.data?.length ?? 0;
  const aiCount = ai.data?.length ?? 0;
  const isFetching = feed.isFetching || trail.isFetching || ai.isFetching;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Moderation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reported feed posts and comments, flagged trail reports and reported AI answers. Dismiss
            keeps the item up; remove hides it for everyone.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() => {
            feed.refetch();
            trail.refetch();
            ai.refetch();
          }}
          disabled={isFetching}
        >
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="space-y-10">
        <QueueSection
          title="Feed"
          count={feedCount}
          isLoading={feed.isLoading}
          isError={feed.isError}
          emptyDescription="When someone reports a post or comment it shows up here."
        >
          {feed.data?.map((report) => (
            <ReportCard key={reportKey(report)} report={report} />
          ))}
        </QueueSection>

        <QueueSection
          title="Trail reports"
          count={trailCount}
          isLoading={trail.isLoading}
          isError={trail.isError}
          emptyDescription="When someone flags a trail report it shows up here."
        >
          {trail.data?.map((flag) => (
            <TrailFlagCard key={flag.reportId} flag={flag} />
          ))}
        </QueueSection>

        <QueueSection
          title="AI answers"
          count={aiCount}
          isLoading={ai.isLoading}
          isError={ai.isError}
          emptyDescription="When someone reports an answer from the AI assistant it shows up here."
        >
          {ai.data?.map((report) => (
            <AiReportCard key={report.id} report={report} />
          ))}
        </QueueSection>
      </div>
    </div>
  );
}
