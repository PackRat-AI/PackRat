'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import { Input } from '@packrat/web-ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteButton } from 'admin-app/components/delete-button';
import {
  deleteTrailCondition,
  getTrailConditions,
  getTrailGeometry,
  searchTrails,
  type TrailConditionReport,
  type TrailGeometry,
  type TrailSearchResult,
} from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { cn } from 'admin-app/lib/utils';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const TrailMap = dynamic(() => import('admin-app/components/trail-map').then((m) => m.TrailMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse rounded-lg" />,
});

// ─── Shared meta badge ────────────────────────────────────────────────────────

function MetaBadge({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}

// ─── Trail search section ─────────────────────────────────────────────────────

const SPORT_OPTIONS = ['hiking', 'cycling', 'skiing', 'running', 'mtb', 'horse_riding'];

function TrailSearchSection({
  onSelect,
  selectedOsmId,
}: {
  onSelect: (osmId: string) => void;
  selectedOsmId: string;
}) {
  const [inputQ, setInputQ] = useState('');
  const [inputSport, setInputSport] = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [activeSport, setActiveSport] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.osm.search({ q: activeQ, sport: activeSport || undefined }),
    queryFn: () => searchTrails({ q: activeQ, sport: activeSport || undefined }),
    enabled: activeQ.length > 0,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = inputQ.trim();
    if (q) {
      setActiveQ(q);
      setActiveSport(inputSport);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search trail name (e.g. John Muir Trail)…"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          className="flex-1 min-w-[240px]"
        />
        <select
          value={inputSport}
          onChange={(e) => setInputSport(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Any sport</option>
          {SPORT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={!inputQ.trim()}>
          Search
        </Button>
      </form>

      {isError && (
        <p className="text-sm text-destructive">
          Trail search failed — check that the OSM database is reachable.
        </p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">Searching trails…</p>
      )}

      {data && data.trails.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No trails found matching &ldquo;{activeQ}&rdquo;
          {activeSport ? ` (sport: ${activeSport})` : ''}.
        </p>
      )}

      {data && data.trails.length > 0 && (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium text-xs uppercase tracking-wide">Name</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  OSM ID
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">Sport</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  Distance
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  Difficulty
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trails.map((trail: TrailSearchResult) => (
                <TableRow
                  key={trail.osmId}
                  className={cn(
                    'hover:bg-muted/20 cursor-pointer',
                    selectedOsmId === trail.osmId && 'bg-muted/40',
                  )}
                  onClick={() => onSelect(trail.osmId)}
                >
                  <TableCell>
                    <p className="text-sm font-medium">
                      {trail.name ?? <span className="text-muted-foreground italic">unnamed</span>}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground">{trail.osmId}</span>
                  </TableCell>
                  <TableCell>
                    {trail.sport ? (
                      <Badge variant="outline" className="text-xs capitalize">
                        {trail.sport}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{trail.distance ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{trail.difficulty ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(trail.osmId);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.hasMore && (
            <p className="text-xs text-muted-foreground px-4 py-2 border-t border-border/40">
              Showing first {data.trails.length} results — refine your search for more specific
              matches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trail viewer section ─────────────────────────────────────────────────────

function TrailViewerSection({ osmId }: { osmId: string }) {
  const { data, isLoading, isError, error } = useQuery<TrailGeometry>({
    queryKey: queryKeys.osm.trail(osmId),
    queryFn: () => getTrailGeometry(osmId),
    enabled: osmId.length > 0,
    retry: false,
  });

  if (!osmId) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Trail Viewer</h3>

      {isError && (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : 'Failed to load trail'}
        </p>
      )}

      {isLoading && (
        <p className="text-muted-foreground text-sm animate-pulse">Loading trail geometry…</p>
      )}

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

          <div className="min-h-[420px]">
            {data.geometry ? (
              <TrailMap geometry={data.geometry} name={data.name} />
            ) : (
              <div className="w-full h-[420px] flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                No geometry available for this trail
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trail conditions section ─────────────────────────────────────────────────

function ConditionRow({ report }: { report: TrailConditionReport }) {
  const queryClient = useQueryClient();

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: () => deleteTrailCondition(report.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['osm', 'conditions'] });
    },
  });

  const conditionColor: Record<string, string> = {
    excellent: 'text-green-500',
    good: 'text-blue-500',
    fair: 'text-yellow-500',
    poor: 'text-red-500',
  };

  return (
    <TableRow className={cn('hover:bg-muted/20', report.deleted && 'opacity-50')}>
      <TableCell>
        <div>
          <p className="text-sm font-medium">{report.trailName}</p>
          {report.trailRegion && (
            <p className="text-xs text-muted-foreground">{report.trailRegion}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize">
          {report.surface}
        </Badge>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'text-xs font-medium capitalize',
            conditionColor[report.overallCondition] ?? 'text-muted-foreground',
          )}
        >
          {report.overallCondition}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{report.userEmail ?? '—'}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {formatDate(new Date(report.createdAt))}
        </span>
      </TableCell>
      <TableCell>
        {!report.deleted && (
          <DeleteButton
            label={report.trailName}
            description="This trail condition report will be soft-deleted."
            onConfirm={async () => {
              await handleDelete();
            }}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

function TrailConditionsSection() {
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data: result, isLoading } = useQuery({
    queryKey: queryKeys.osm.conditions(activeSearch || undefined),
    queryFn: () => getTrailConditions({ q: activeSearch || undefined }),
  });

  const reports = result?.data ?? [];
  const total = result?.total ?? 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Trail Condition Reports</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setActiveSearch(search.trim());
        }}
        className="flex gap-2 max-w-sm"
      >
        <Input
          placeholder="Filter by trail name or region…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading reports…</p>
      ) : (
        <>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-medium text-xs uppercase tracking-wide">
                    Trail
                  </TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wide">
                    Surface
                  </TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wide">
                    Condition
                  </TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wide">
                    Reporter
                  </TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wide w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8 text-sm"
                    >
                      No trail condition reports found
                      {activeSearch ? ` matching "${activeSearch}"` : ''}.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((r) => <ConditionRow key={r.id} report={r} />)
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {reports.length.toLocaleString()} of {total.toLocaleString()} report
            {total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'search' | 'conditions';

export default function TrailsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [selectedOsmId, setSelectedOsmId] = useState('');

  function handleSelectTrail(osmId: string) {
    setSelectedOsmId(osmId);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'search', label: 'Trail Search' },
    { id: 'conditions', label: 'Condition Reports' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Trails</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Search OSM routes, inspect geometry, and review condition reports.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'search' && (
        <div className="space-y-8">
          <TrailSearchSection onSelect={handleSelectTrail} selectedOsmId={selectedOsmId} />
          {selectedOsmId && <TrailViewerSection osmId={selectedOsmId} />}
        </div>
      )}

      {activeTab === 'conditions' && <TrailConditionsSection />}
    </div>
  );
}
