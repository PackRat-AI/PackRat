'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@packrat/web-ui/components/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@packrat/web-ui/components/avatar';
import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import { cn } from '@packrat/web-ui/lib/utils';
import { useResolveFeedReport, useSetFeedUserSuspended } from 'admin-app/hooks/use-feed-moderation';
import type { AdminFeedReport } from 'admin-app/lib/api';
import { formatDistanceToNow } from 'admin-app/lib/date';
import { Ban, Check, Flag, ImageIcon, MessageSquare, Trash2, UserCheck } from 'lucide-react';
import type React from 'react';

type Person = AdminFeedReport['author'];

const REASON_LABELS: Readonly<Record<AdminFeedReport['reasons'][number], string>> = Object.freeze({
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate',
} as const);

const MAX_THUMBNAILS = 4;

function displayName(person: Person): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
  return name || 'Unnamed user';
}

function initials(person: Person): string {
  const letters = [person.firstName, person.lastName]
    .map((part) => part?.trim()[0])
    .filter(Boolean)
    .join('');
  return letters.toUpperCase() || '?';
}

function PersonAvatar({ person, className }: { person: Person; className?: string }) {
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
      <AvatarFallback className="text-[10px] font-medium">{initials(person)}</AvatarFallback>
    </Avatar>
  );
}

function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ContentPreview({ report }: { report: AdminFeedReport }) {
  const shown = report.images.slice(0, MAX_THUMBNAILS);
  const hidden = report.images.length - shown.length;

  return (
    <div className="space-y-3">
      {report.content ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{report.content}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          {report.targetType === 'post' ? 'No caption' : 'Empty comment'}
        </p>
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

export function ReportCard({ report }: { report: AdminFeedReport }) {
  const { mutate: resolve, isPending: isResolving } = useResolveFeedReport();
  const { mutate: setSuspended, isPending: isSuspending } = useSetFeedUserSuspended();

  const isPost = report.targetType === 'post';
  const noun = isPost ? 'post' : 'comment';
  const authorName = displayName(report.author);
  const busy = isResolving || isSuspending;

  return (
    <article className="rounded-lg border border-border/60 bg-card">
      {/* ── Header: type, report count, timing ─────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
          {isPost ? <ImageIcon className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
          {isPost ? 'Post' : 'Comment'}
        </Badge>
        <Badge variant="destructive" className="gap-1 text-[11px] font-medium">
          <Flag className="h-3 w-3" />
          {report.reportCount === 1 ? '1 report' : `${report.reportCount} reports`}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {isPost
            ? `Post #${report.postId}`
            : `Comment #${report.targetId} on post #${report.postId}`}
        </span>
        <span
          className="ml-auto text-xs text-muted-foreground"
          title={`First reported ${new Date(report.firstReportedAt).toLocaleString()}`}
        >
          {report.reportCount > 1
            ? `First ${formatDistanceToNow(new Date(report.firstReportedAt))} · last ${formatDistanceToNow(new Date(report.lastReportedAt))}`
            : `Reported ${formatDistanceToNow(new Date(report.lastReportedAt))}`}
        </span>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_16rem]">
        {/* ── Content as posted ────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2.5">
            <PersonAvatar person={report.author} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{authorName}</span>
                {report.authorSuspended && (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                    Suspended
                  </Badge>
                )}
              </div>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {report.author.id}
              </p>
            </div>
          </div>
          <ContentPreview report={report} />
        </div>

        {/* ── Why and by whom ──────────────────────────────────────────────── */}
        <aside className="space-y-3 md:border-l md:border-border/60 md:pl-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reasons
            </p>
            <div className="flex flex-wrap gap-1.5">
              {report.reasons.map((reason) => (
                <Badge key={reason} variant="outline" className="text-[11px] font-medium">
                  {REASON_LABELS[reason]}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reported by
            </p>
            <ul className="space-y-1.5">
              {report.reporters.map((reporter) => (
                <li key={reporter.id} className="flex items-center gap-2">
                  <PersonAvatar person={reporter} className="h-6 w-6" />
                  <span className="truncate text-xs">{displayName(reporter)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
        {report.authorSuspended ? (
          <ConfirmButton
            trigger={
              <Button variant="ghost" size="sm" className="h-8" disabled={busy}>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Reinstate author
              </Button>
            }
            title={`Reinstate ${authorName}?`}
            description="They can post and comment again, and their posts and comments become visible again. Anything you removed stays removed."
            confirmLabel="Reinstate"
            onConfirm={() => setSuspended({ userId: report.author.id, suspended: false })}
          />
        ) : (
          <ConfirmButton
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Suspend author
              </Button>
            }
            title={`Suspend ${authorName}?`}
            description="They can no longer post or comment, and everything they have posted is hidden from everyone until you reinstate them."
            confirmLabel="Suspend"
            destructive
            onConfirm={() => setSuspended({ userId: report.author.id, suspended: true })}
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busy}
            onClick={() => resolve({ report, action: 'dismiss' })}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Dismiss
          </Button>
          <ConfirmButton
            trigger={
              <Button variant="destructive" size="sm" className="h-8" disabled={busy}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove {noun}
              </Button>
            }
            title={`Remove this ${noun}?`}
            description={`The ${noun} is hidden for everyone and every report on it is closed.`}
            confirmLabel={`Remove ${noun}`}
            destructive
            onConfirm={() => resolve({ report, action: 'remove' })}
          />
        </div>
      </footer>
    </article>
  );
}
