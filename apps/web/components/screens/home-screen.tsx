'use client';
import { gramsToLbs, useCurrentUser, usePacks, useTrips } from '@packrat/app';
import { Bot, ChevronRight, Cloud, CloudRain, Sun, Thermometer, Wind, Zap } from 'lucide-react';
import type React from 'react';
import type { Screen } from 'web-app/components/app-shell';
import { Skeleton } from 'web-app/components/ui/skeleton';
import { useWeight } from 'web-app/lib/weight-context';

interface HomeScreenProps {
  navigate: (s: Screen) => void;
}

export function HomeScreen({ navigate }: HomeScreenProps) {
  const { fw } = useWeight();
  const { data: currentUserData, isLoading: userLoading } = useCurrentUser();
  const user = currentUserData?.user;
  const { data: packsData, isLoading: packsLoading } = usePacks();
  const { data: trips, isLoading: tripsLoading } = useTrips();

  const currentPack = packsData?.[0];
  const nextTrip = trips?.[0];

  const _isLoading = userLoading || packsLoading || tripsLoading;

  return (
    <div className="px-4 pt-5 pb-24 md:px-6 md:pt-6 space-y-5 max-w-2xl mx-auto md:max-w-none">
      {/* Greeting */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">Good morning,</p>
        {userLoading ? (
          <Skeleton className="h-8 w-40" />
        ) : (
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Hey, {user?.firstName ?? 'there'}!
          </h1>
        )}
      </div>

      {/* Current Pack Summary */}
      {packsLoading ? (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-2 w-full" />
        </div>
      ) : currentPack ? (
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#30d158] animate-pulse" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Active Pack
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('packs')}
              className="text-primary text-xs font-semibold flex items-center gap-0.5"
            >
              View <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-lg font-semibold mb-0.5">{currentPack.name}</p>
          <p className="text-3xl font-bold text-foreground">
            {gramsToLbs(currentPack.baseWeight)}{' '}
            <span className="text-lg font-medium text-muted-foreground">base weight</span>
          </p>
          <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{currentPack.items?.length ?? 0}</span>{' '}
            items
            <span>·</span>
            <span className="font-medium text-foreground">{fw(currentPack.baseWeight)}</span> base
            <span>·</span>
            <span className="font-medium text-foreground">{fw(currentPack.totalWeight)}</span> total
          </div>
          {/* Weight bar */}
          <div className="mt-3">
            <WeightBar current={currentPack.baseWeight} target={4536} />
          </div>
        </div>
      ) : null}

      {/* Quick Access Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Upcoming Trip */}
        {tripsLoading ? (
          <div className="rounded-2xl bg-card border border-border p-3.5">
            <Skeleton className="h-9 w-9 rounded-xl mb-2" />
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : nextTrip ? (
          <QuickCard
            title="Next Trip"
            subtitle={nextTrip.name}
            meta={nextTrip.startDate != null ? String(nextTrip.startDate) : 'TBD'}
            icon={<span className="text-xl">&#9968;</span>}
            onClick={() => navigate('trips')}
            color="bg-[#0385ff]/10"
          />
        ) : (
          <QuickCard
            title="Next Trip"
            subtitle="No trips planned"
            meta="Plan a trip"
            icon={<span className="text-xl">&#9968;</span>}
            onClick={() => navigate('trips')}
            color="bg-[#0385ff]/10"
          />
        )}
        {/* Weather Alert */}
        <QuickCard
          title="Weather Alert"
          subtitle="Afternoon thunderstorms"
          meta="Yosemite Valley - Today"
          icon={<CloudRain className="h-5 w-5 text-[#fe4336]" />}
          color="bg-[#fe4336]/10"
          onClick={() => navigate('trips')}
        />
        {/* AI Suggestions */}
        <QuickCard
          title="AI Suggestion"
          subtitle="Swap shelter to save 170g"
          meta="Optimize pack"
          icon={<Zap className="h-5 w-5 text-[#0385ff]" />}
          color="bg-[#0385ff]/10"
          onClick={() => navigate('ai')}
        />
        {/* Shopping List */}
        <QuickCard
          title="Shopping List"
          subtitle="3 items to buy"
          meta="~$274 estimated"
          icon={<span className="text-xl">&#128722;</span>}
          color="bg-[#bf5af2]/10"
          onClick={() => navigate('profile')}
        />
      </div>

      {/* Open AI Assistant CTA */}
      <button
        type="button"
        onClick={() => navigate('ai')}
        className="w-full flex items-center gap-3 rounded-2xl bg-primary p-4 text-left transition-all active:scale-[0.98]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">Open AI Assistant</p>
          <p className="text-white/70 text-xs truncate">
            Build a pack, get gear advice, optimize weight...
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/60 shrink-0" />
      </button>

      {/* Weather Widget */}
      <WeatherWidget />

      {/* Season suggestions teaser */}
      <button
        type="button"
        className="w-full rounded-2xl bg-card border border-border p-4 flex items-center gap-3 text-left hover:bg-accent/50 transition-colors"
        onClick={() => navigate('home')}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#30d158]/15 shrink-0">
          <span className="text-lg">&#127810;</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Fall Season Gear Swap</p>
          <p className="text-muted-foreground text-xs">
            AI recommends 4 adjustments for your upcoming trips
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function WeightBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100);
  const color = pct < 70 ? '#30d158' : pct < 90 ? '#ff9f0a' : '#fe4336';
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{Math.round(pct)}% of target</span>
        <span>{gramsToLbs(target)} target</span>
      </div>
    </div>
  );
}

function QuickCard({
  title,
  subtitle,
  meta,
  icon,
  color,
  onClick,
}: {
  title: string;
  subtitle: string;
  meta: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-2xl bg-card border border-border p-3.5 text-left transition-all active:scale-[0.97]"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <p className="text-sm font-semibold mt-0.5 leading-tight">{subtitle}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{meta}</p>
      </div>
    </button>
  );
}

function WeatherWidget() {
  const days = [
    { day: 'Mon', icon: <Sun className="h-4 w-4 text-[#ff9f0a]" />, high: 72, low: 48 },
    { day: 'Tue', icon: <Cloud className="h-4 w-4 text-muted-foreground" />, high: 67, low: 44 },
    { day: 'Wed', icon: <CloudRain className="h-4 w-4 text-[#0385ff]" />, high: 58, low: 41 },
    { day: 'Thu', icon: <CloudRain className="h-4 w-4 text-[#0385ff]" />, high: 61, low: 43 },
    { day: 'Fri', icon: <Sun className="h-4 w-4 text-[#ff9f0a]" />, high: 70, low: 47 },
    { day: 'Sat', icon: <Sun className="h-4 w-4 text-[#ff9f0a]" />, high: 74, low: 49 },
    { day: 'Sun', icon: <Sun className="h-4 w-4 text-[#ff9f0a]" />, high: 75, low: 50 },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Weather - Yosemite Valley
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-3xl font-bold">62°F</span>
            <div>
              <p className="text-sm font-medium">Partly Cloudy</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Wind className="h-3 w-3" /> 12 mph
                </span>
                <span className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3" /> Feels 58°
                </span>
              </div>
            </div>
          </div>
        </div>
        <Sun className="h-12 w-12 text-[#ff9f0a]" />
      </div>
      <div className="border-t border-border pt-3 flex gap-0.5">
        {days.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{d.day}</span>
            {d.icon}
            <span className="text-[11px] font-semibold">{d.high}°</span>
            <span className="text-[10px] text-muted-foreground">{d.low}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}
