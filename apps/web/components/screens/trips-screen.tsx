'use client';
import { useCreateTripMutation, usePacks, useTrips } from '@packrat/app';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Cloud,
  MapPin,
  Navigation2,
  Plus,
  Square,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { BetaBadge } from 'web-app/components/beta-badge';
import { Skeleton } from 'web-app/components/ui/skeleton';
import type { PackWithWeights, Trip } from 'web-app/lib/types';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

export function TripsScreen() {
  const { fw } = useWeight();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTripName, setNewTripName] = useState('');

  const { data: tripsRaw, isLoading: tripsLoading } = useTrips();
  const createTrip = useCreateTripMutation();
  const trips = tripsRaw as Trip[] | undefined; // safe-cast: API boundary narrowing
  const { data: packsData, isLoading: packsLoading } = usePacks();

  const isLoading = tripsLoading || packsLoading;

  if (selectedTrip) {
    // safe-cast: API boundary narrowing to local weight-augmented type
    const linkedPack = (packsData as PackWithWeights[] | undefined)?.find(
      (p) => p.id === selectedTrip.packId,
    );
    return (
      <TripDetail
        trip={selectedTrip}
        linkedPack={linkedPack}
        onBack={() => setSelectedTrip(null)}
        fw={fw}
      />
    );
  }

  return (
    <div className="px-4 pt-5 pb-28 md:px-6 md:pt-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
        <BetaBadge />
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Upcoming adventures — linked packs, itineraries, and conditions.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {trips?.map((trip) => {
            // safe-cast: API boundary narrowing to local weight-augmented type
            const linkedPack = (packsData as PackWithWeights[] | undefined)?.find(
              (p) => p.id === trip.packId,
            );
            return (
              <TripCard
                key={trip.id}
                trip={trip}
                linkedPack={linkedPack}
                fw={fw}
                onClick={() => setSelectedTrip(trip)}
              />
            );
          })}

          {showCreate ? (
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <h3 className="font-semibold text-sm">New Trip</h3>
              <input
                type="text"
                placeholder="Trip name..."
                value={newTripName}
                onChange={(e) => setNewTripName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTripName.trim()) {
                    createTrip.mutate(
                      { name: newTripName.trim() },
                      {
                        onSuccess: () => {
                          setShowCreate(false);
                          setNewTripName('');
                        },
                      },
                    );
                  }
                  if (e.key === 'Escape') {
                    setShowCreate(false);
                    setNewTripName('');
                  }
                }}
                className="w-full rounded-xl bg-muted px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setNewTripName('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTripName.trim()) return;
                    createTrip.mutate(
                      { name: newTripName.trim() },
                      {
                        onSuccess: () => {
                          setShowCreate(false);
                          setNewTripName('');
                        },
                      },
                    );
                  }}
                  disabled={!newTripName.trim() || createTrip.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
                >
                  {createTrip.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full rounded-2xl border-2 border-dashed border-border py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">Plan a New Trip</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TripCard({
  trip,
  linkedPack,
  fw,
  onClick,
}: {
  trip: Trip;
  linkedPack?: PackWithWeights;
  fw: (g: number) => string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-card border border-border p-4 text-left transition-all active:scale-[0.99]"
    >
      {/* Map thumbnail placeholder */}
      <div className="rounded-xl bg-gradient-to-br from-[#0385ff]/10 to-[#30d158]/10 border border-border h-28 flex items-center justify-center mb-3 relative overflow-hidden">
        <Navigation2 className="h-10 w-10 text-primary/30" />
        {trip.location?.name && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-white">{trip.location.name}</span>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-base">{trip.name}</h3>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDateRange({ start: trip.startDate, end: trip.endDate })}</span>
      </div>

      {trip.description && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{trip.description}</p>
      )}

      {linkedPack && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Linked Pack</p>
            <p className="text-sm font-medium truncate">{linkedPack.name}</p>
          </div>
          <span className="text-sm font-bold">{fw(linkedPack.baseWeight)}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </button>
  );
}

function TripDetail({
  trip,
  linkedPack,
  onBack,
  fw,
}: {
  trip: Trip;
  linkedPack?: PackWithWeights;
  onBack: () => void;
  fw: (g: number) => string;
}) {
  // Mock checklist for trips
  const [checklist, setChecklist] = useState([
    { id: 'c1', text: 'Get wilderness permit', done: true },
    { id: 'c2', text: 'Send resupply box', done: true },
    { id: 'c3', text: 'Bear canister packed', done: false },
    { id: 'c4', text: 'Charge all devices', done: false },
    { id: 'c5', text: 'Download offline maps', done: true },
  ]);

  const toggleCheck = (id: string) => {
    setChecklist((c) => c.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 md:px-6 md:pt-6 border-b border-border sticky top-0 z-10 bg-background">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{trip.name}</h1>
          <p className="text-xs text-muted-foreground">
            {formatDateRange({ start: trip.startDate, end: trip.endDate })}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6 space-y-5">
        {/* Map */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0385ff]/10 to-[#30d158]/10 border border-border h-40 flex items-center justify-center relative overflow-hidden">
          <Navigation2 className="h-12 w-12 text-primary/30" />
          {trip.location?.name && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-white">{trip.location.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {trip.description && (
          <div>
            <h3 className="text-sm font-semibold mb-2">About</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{trip.description}</p>
          </div>
        )}

        {/* Notes */}
        {trip.notes && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{trip.notes}</p>
          </div>
        )}

        {/* Weather Widget */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Weather Forecast</h3>
            <BetaBadge />
          </div>
          <div className="flex gap-3">
            {[
              { day: 'Day 1', icon: Sun, temp: '72°/48°' },
              { day: 'Day 2', icon: Cloud, temp: '67°/44°' },
              { day: 'Day 3', icon: Sun, temp: '70°/46°' },
            ].map((d) => (
              <div key={d.day} className="flex-1 rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{d.day}</p>
                <d.icon className="h-5 w-5 mx-auto text-[#ff9f0a]" />
                <p className="text-xs font-semibold mt-1">{d.temp}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Pack */}
        {linkedPack && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <h3 className="font-semibold text-sm mb-3">Linked Pack</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{linkedPack.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {linkedPack.items?.length ?? 0} items
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{fw(linkedPack.baseWeight)}</p>
                <p className="text-xs text-muted-foreground">base weight</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 w-full py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold"
            >
              View Pack Details
            </button>
          </div>
        )}

        {/* Checklist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Trip Checklist</h3>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{checklist.length} complete
            </span>
          </div>
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            {checklist.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                {item.done ? (
                  <CheckSquare className="h-5 w-5 text-[#30d158] shrink-0" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className={cn('text-sm', item.done && 'text-muted-foreground line-through')}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 w-full py-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            + Add task
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateRange({ start, end }: { start?: string | null; end?: string | null }): string {
  if (!start) return 'Dates TBD';
  const s = new Date(start);
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!end) return startStr;
  const e = new Date(end);
  const endStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} - ${endStr}`;
}
