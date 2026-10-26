'use client';

import { capitalize } from '@packrat/utils';
import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import {
  ConfirmButton,
  displayName,
  PersonAvatar,
} from 'admin-app/components/moderation/report-card';
import { useResolveTrailFlags } from 'admin-app/hooks/use-trail-moderation';
import type { AdminTrailFlag } from 'admin-app/lib/api';
import { formatDistanceToNow } from 'admin-app/lib/date';
import { Check, Flag, Mountain, Trash2 } from 'lucide-react';

const REASON_LABELS: Readonly<Record<AdminTrailFlag['reasons'][number], string>> = Object.freeze({
  inaccurate: 'Inaccurate',
  offensive: 'Offensive',
  spam: 'Spam',
} as const);

const MAX_THUMBNAILS = 4;

function ReportPreview({ flag }: { flag: AdminTrailFlag }) {
  const shown = flag.photos.slice(0, MAX_THUMBNAILS);
  const hidden = flag.photos.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[11px] font-medium">
          {capitalize(flag.overallCondition)}
        </Badge>
        {flag.hazards.map((hazard) => (
          <Badge key={hazard} variant="secondary" className="text-[11px] font-normal">
            {capitalize(hazard.replaceAll('_', ' '))}
          </Badge>
        ))}
      </div>

      {flag.notes ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{flag.notes}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No notes</p>
      )}

      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shown.map((src, index) => {
            const isLast = index === shown.length - 1 && hidden > 0;
            return (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="relative block h-24 w-24 overflow-hidden rounded-md border border-border/60 bg-muted"
                aria-label={`Open photo ${index + 1} in a new tab`}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                {isLast && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-white">
                    +{hidden}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TrailFlagCard({ flag }: { flag: AdminTrailFlag }) {
  const { mutate: resolve, isPending } = useResolveTrailFlags();

  return (
    <article className="rounded-lg border border-border/60 bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
          <Mountain className="h-3 w-3" />
          Trail report
        </Badge>
        <Badge variant="destructive" className="gap-1 text-[11px] font-medium">
          <Flag className="h-3 w-3" />
          {flag.flagCount === 1 ? '1 flag' : `${flag.flagCount} flags`}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">{flag.trailName}</span>
        <span
          className="ml-auto text-xs text-muted-foreground"
          title={`First flagged ${new Date(flag.firstFlaggedAt).toLocaleString()}`}
        >
          {flag.flagCount > 1
            ? `First ${formatDistanceToNow(new Date(flag.firstFlaggedAt))} · last ${formatDistanceToNow(new Date(flag.lastFlaggedAt))}`
            : `Flagged ${formatDistanceToNow(new Date(flag.lastFlaggedAt))}`}
        </span>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2.5">
            <PersonAvatar person={flag.author} />
            <div className="min-w-0">
              <span className="truncate text-sm font-medium">{displayName(flag.author)}</span>
              <p className="truncate text-[11px] text-muted-foreground">
                Written {formatDistanceToNow(new Date(flag.writtenAt))}
              </p>
            </div>
          </div>
          <ReportPreview flag={flag} />
        </div>

        <aside className="space-y-3 md:border-l md:border-border/60 md:pl-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reasons
            </p>
            <div className="flex flex-wrap gap-1.5">
              {flag.reasons.map((reason) => (
                <Badge key={reason} variant="outline" className="text-[11px] font-medium">
                  {REASON_LABELS[reason]}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Flagged by
            </p>
            <ul className="space-y-1.5">
              {flag.reporters.map((reporter) => (
                <li key={reporter.id} className="flex items-center gap-2">
                  <PersonAvatar person={reporter} className="h-6 w-6" />
                  <span className="truncate text-xs">{displayName(reporter)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-2.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isPending}
          onClick={() => resolve({ flag, action: 'dismiss' })}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Dismiss
        </Button>
        <ConfirmButton
          trigger={
            <Button variant="destructive" size="sm" className="h-8" disabled={isPending}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove report
            </Button>
          }
          title="Remove this report?"
          description="The report is deleted for everyone, its author included, and every flag on it is closed."
          confirmLabel="Remove report"
          destructive
          onConfirm={() => resolve({ flag, action: 'remove' })}
        />
      </footer>
    </article>
  );
}
