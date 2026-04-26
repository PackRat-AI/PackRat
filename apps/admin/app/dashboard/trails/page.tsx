'use client';

import { Button } from '@packrat/web-ui/components/button';
import { Input } from '@packrat/web-ui/components/input';
import { useQuery } from '@tanstack/react-query';
import { getTrailGeometry, type TrailGeometry } from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const LEADING_SLASH_RE = /^r?\//;

const TrailMap = dynamic(() => import('admin-app/components/trail-map').then((m) => m.TrailMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse rounded-lg" />,
});

function MetaBadge({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}

export default function TrailViewerPage() {
  const [input, setInput] = useState('');
  const [osmId, setOsmId] = useState('');

  const { data, isLoading, isError, error } = useQuery<TrailGeometry>({
    queryKey: queryKeys.osm.trail(osmId),
    queryFn: () => getTrailGeometry(osmId),
    enabled: osmId.length > 0,
    retry: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().replace(LEADING_SLASH_RE, '');
    if (trimmed) setOsmId(trimmed);
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Trail Viewer</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Enter an OSM relation ID to visualise its geometry and verify stitching.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
        <Input
          placeholder="OSM relation ID (e.g. 12345678)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono"
        />
        <Button type="submit" disabled={!input.trim()}>
          Load
        </Button>
      </form>

      {isError && (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : 'Failed to load trail'}
        </p>
      )}

      {isLoading && <p className="text-muted-foreground text-sm animate-pulse">Loading trail…</p>}

      {data && (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Name</span>
              <span className="text-sm font-medium">
                {data.name ?? <span className="text-muted-foreground italic">unnamed</span>}
              </span>
            </div>
            <MetaBadge label="OSM ID" value={data.osmId} />
            <MetaBadge label="Sport" value={data.sport} />
            <MetaBadge label="Network" value={data.network} />
            <MetaBadge label="Distance" value={data.distance} />
            <MetaBadge label="Difficulty" value={data.difficulty} />
            {!data.geometry && (
              <span className="text-sm text-amber-600 font-medium self-end">
                ⚠ No geometry — stitching returned null
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[500px]">
            {data.geometry ? (
              <TrailMap geometry={data.geometry} name={data.name} />
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                No geometry available for this trail
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
