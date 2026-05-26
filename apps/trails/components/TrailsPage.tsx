'use client';

import { AlertCircle, MapPinOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AuthGate } from 'trails-app/components/AuthGate';
import { DownloadCTA } from 'trails-app/components/DownloadCTA';
import { SearchBar } from 'trails-app/components/SearchBar';
import { TrailCard } from 'trails-app/components/TrailCard';
import { DEFAULT_CENTER, getUserLocation } from 'trails-app/lib/geolocation';
import { loadNearbyTrails, type TrailSummaryWithCoords } from 'trails-app/lib/overpass';
import { AuthExpiredError, searchTrails, type TrailSearchParams } from 'trails-app/lib/trailSearch';
import { useAuth } from 'trails-app/lib/useAuth';

// Leaflet requires window — load with ssr:false
const TrailMap = dynamic(() => import('trails-app/components/TrailMap').then((m) => m.TrailMap), {
  ssr: false,
  loading: () => (
    <div className="trail-map animate-pulse rounded-lg bg-muted" style={{ minHeight: 360 }} />
  ),
});

type MapState =
  | { status: 'loading' }
  | { status: 'idle'; center: [number, number] }
  | { status: 'error'; message: string };

export function TrailsPage() {
  const { isAuthed, openAuthGate } = useAuth();

  const [mapState, setMapState] = useState<MapState>({ status: 'loading' });
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>();
  const [publicTrails, setPublicTrails] = useState<TrailSummaryWithCoords[]>([]);
  const [searchTrailResults, setSearchTrailResults] = useState<TrailSummaryWithCoords[] | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOsmId, setSelectedOsmId] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const lastSearchRef = useRef<TrailSearchParams | null>(null);

  // Load public trails via Overpass on mount
  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      const coords = await getUserLocation();
      if (cancelled) return;

      const center = coords ?? DEFAULT_CENTER;
      setMapCenter(center);
      setMapState({ status: 'idle', center });

      if (!coords) {
        return;
      }

      try {
        const trails = await loadNearbyTrails({ lat: center[0], lon: center[1] });
        if (!cancelled) setPublicTrails(trails);
      } catch {
        // Overpass failure is non-fatal; map still shows with no trails
        if (!cancelled) setPublicTrails([]);
      }
    }

    loadMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    async (params: TrailSearchParams, append = false) => {
      setSearchLoading(true);
      try {
        const { trails, hasMore: more } = await searchTrails(params);
        setSearchTrailResults((prev) => (append && prev ? [...prev, ...trails] : trails));
        setHasMore(more);
        setOffset((params.offset ?? 0) + trails.length);
        lastSearchRef.current = params;
      } catch (err) {
        if (err instanceof AuthExpiredError) {
          toast.error('Session expired. Please log in again.');
          openAuthGate();
        } else if (err instanceof Error && err.message.includes('429')) {
          toast.error('Too many requests. Please wait a moment.');
        } else {
          toast.error('Search failed. Please try again.');
        }
      } finally {
        setSearchLoading(false);
      }
    },
    [openAuthGate],
  );

  function handleSearch(query: string) {
    if (!query.trim()) {
      setSearchTrailResults(null);
      return;
    }
    setOffset(0);
    setHasMore(false);
    runSearch({ q: query.trim(), limit: 20, offset: 0 });
  }

  function handleLoadMore() {
    if (!lastSearchRef.current) return;
    runSearch({ ...lastSearchRef.current, offset }, true);
  }

  const displayedTrails = searchTrailResults ?? publicTrails;
  const isSearchMode = searchTrailResults !== null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-tight">PackRat Trails</span>
        </div>
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            loading={searchLoading}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
          />
        </div>
        {isAuthed && isSearchMode && (
          <button
            type="button"
            onClick={() => {
              setSearchTrailResults(null);
              setSearchQuery('');
            }}
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Clear
          </button>
        )}
      </header>

      {/* Body: map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="relative flex-1">
          {mapState.status === 'loading' ? (
            <div className="flex h-full items-center justify-center bg-muted">
              <div className="text-sm text-muted-foreground">Getting your location…</div>
            </div>
          ) : (
            <TrailMap
              center={mapCenter}
              trails={displayedTrails}
              selectedOsmId={selectedOsmId}
              onTrailClick={setSelectedOsmId}
            />
          )}

          {/* Search-to-login prompt overlay — shown when map is loaded but user is not authed */}
          {!isAuthed && mapState.status === 'idle' && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
              <button
                type="button"
                onClick={openAuthGate}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                Sign in to search trails
              </button>
            </div>
          )}
        </div>

        {/* Trail list sidebar */}
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l">
          <div className="border-b px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {isSearchMode
                ? `${displayedTrails.length} result${displayedTrails.length !== 1 ? 's' : ''}`
                : 'Trails near you'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {displayedTrails.length === 0 && !searchLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                {isSearchMode ? (
                  <>
                    <MapPinOff className="h-8 w-8" />
                    <p className="text-sm">No trails found. Try a different search.</p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-sm">
                      No trails loaded nearby. Allow location access to see trails.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {displayedTrails.map((trail) => (
                <TrailCard
                  key={trail.osmId}
                  trail={trail}
                  selected={trail.osmId === selectedOsmId}
                  onClick={() =>
                    setSelectedOsmId(trail.osmId === selectedOsmId ? undefined : trail.osmId)
                  }
                />
              ))}
            </div>

            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={searchLoading}
                className="mt-3 w-full rounded-md border py-2 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                {searchLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </aside>
      </div>

      <AuthGate />
      <DownloadCTA />
    </div>
  );
}
