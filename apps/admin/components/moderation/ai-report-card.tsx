'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import { displayName, PersonAvatar } from 'admin-app/components/moderation/report-card';
import { useResolveAiReport } from 'admin-app/hooks/use-ai-moderation';
import type { AdminAiReport } from 'admin-app/lib/api';
import { formatDistanceToNow } from 'admin-app/lib/date';
import { Check, CheckCheck, Flag, Sparkles } from 'lucide-react';

const REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  inappropriate_content: 'Inappropriate',
  harmful_advice: 'Harmful advice',
  inaccurate_information: 'Inaccurate',
  offensive_language: 'Offensive',
  safety_concern: 'Safety concern',
  other: 'Other',
} as const);

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replaceAll('_', ' ');
}

function Exchange({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}

export function AiReportCard({ report }: { report: AdminAiReport }) {
  const { mutate: resolve, isPending } = useResolveAiReport();

  return (
    <article className="rounded-lg border border-border/60 bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
          <Sparkles className="h-3 w-3" />
          AI answer
        </Badge>
        <Badge variant="destructive" className="gap-1 text-[11px] font-medium">
          <Flag className="h-3 w-3" />
          {reasonLabel(report.reason)}
        </Badge>
        <span
          className="ml-auto text-xs text-muted-foreground"
          title={new Date(report.reportedAt).toLocaleString()}
        >
          Reported {formatDistanceToNow(new Date(report.reportedAt))}
        </span>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-3">
          <Exchange label="Question" text={report.userQuery} />
          <Exchange label="Answer" text={report.aiResponse} />
        </div>

        <aside className="space-y-3 md:border-l md:border-border/60 md:pl-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reported by
            </p>
            <div className="flex items-center gap-2">
              <PersonAvatar person={report.reporter} className="h-6 w-6" />
              <span className="truncate text-xs">{displayName(report.reporter)}</span>
            </div>
          </div>
          {report.userComment && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Comment
              </p>
              <p className="text-sm italic leading-relaxed break-words">{report.userComment}</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-2.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isPending}
          onClick={() => resolve({ report, action: 'dismiss' })}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Dismiss
        </Button>
        <Button
          size="sm"
          className="h-8"
          disabled={isPending}
          onClick={() => resolve({ report, action: 'resolve' })}
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          Mark resolved
        </Button>
      </footer>
    </article>
  );
}
