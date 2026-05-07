'use client';

import { cn } from '@packrat/web-ui/lib/utils';
import { MapPin, Mountain } from 'lucide-react';
import type { TrailSummaryWithCoords } from 'trails-app/lib/overpass';

interface TrailCardProps {
  trail: TrailSummaryWithCoords;
  selected?: boolean;
  onClick?: () => void;
}

const SPORT_LABELS: Record<string, string> = {
  hiking: 'Hiking',
  cycling: 'Cycling',
  running: 'Running',
  skiing: 'Skiing',
  horse_riding: 'Horse Riding',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  hard: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  expert: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function TrailCard({ trail, selected, onClick }: TrailCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent',
        selected && 'border-primary bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{trail.name ?? 'Unnamed Trail'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {trail.sport && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Mountain className="h-3 w-3" />
                {SPORT_LABELS[trail.sport] ?? trail.sport}
              </span>
            )}
            {trail.difficulty && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  DIFFICULTY_COLORS[trail.difficulty.toLowerCase()] ??
                    'bg-muted text-muted-foreground',
                )}
              >
                {trail.difficulty}
              </span>
            )}
          </div>
        </div>
        {trail.distance && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {trail.distance}
          </div>
        )}
      </div>
      {trail.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{trail.description}</p>
      )}
    </button>
  );
}
