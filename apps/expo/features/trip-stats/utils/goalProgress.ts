import type { TripGoal, TripGoalMetric } from '@packrat/schemas/tripStats';
import type { TripSummit } from '@packrat/schemas/trips';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import {
  normalizedPeakName,
  type ParksAndPeaks,
  parksVisitedBetween,
  peakKey,
  peaksSummitedBetween,
  visitedParks,
} from './parksAndPeaks';
import { clipTrips, computeTotals, dayFromString, type FinishedTrip } from './tripStats';

export type StatsGoal = Pick<
  TripGoal,
  | 'id'
  | 'kind'
  | 'metric'
  | 'target'
  | 'year'
  | 'name'
  | 'startDate'
  | 'endDate'
  | 'trailCode'
  | 'peaks'
  | 'parkCodes'
  | 'deleted'
  | 'localCreatedAt'
>;

export type GoalPhase = 'upcoming' | 'active' | 'ended';

export type GoalPace =
  | { kind: 'onPace' }
  | { kind: 'ahead'; by: number }
  | { kind: 'behind'; by: number };

/**
 * Where a goal stands today: how much is done, how far through its window the user is, and
 * whether they're ahead of or behind an even pace. Pace follows Strava's goal cards: the target
 * spread evenly over the window. The wording stays neutral — a slow start is a difference, not a
 * failure.
 */
export interface GoalProgress {
  goal: StatsGoal;
  /** First and last day of the window, both counted. A list goal with no finish date has no end. */
  start: Date;
  end: Date | null;
  phase: GoalPhase;
  /** In the metric's base unit: a count, or metres. */
  value: number;
  /** 0…1 of the window gone by, today included. */
  elapsed: number;
  pace: GoalPace | null;
}

/** Distance and elevation are entered in the user's unit and stored in metres. */
export function isMeasuredMetric(metric: TripGoalMetric): boolean {
  return metric === 'distance' || metric === 'elevation';
}

export function goalFraction(progress: GoalProgress): number {
  return progress.goal.target > 0 ? progress.value / progress.goal.target : 0;
}

export function isGoalComplete(progress: GoalProgress): boolean {
  return progress.value >= progress.goal.target;
}

export function goalRemaining(progress: GoalProgress): number {
  return Math.max(progress.goal.target - progress.value, 0);
}

/**
 * An annual goal runs 1 January to 31 December of its year; a custom goal runs its own days. A
 * list goal runs from the day it was made (pace is measured from there) to its finish date, if
 * it has one.
 */
export function goalWindow({
  goal,
  now = new Date(),
}: {
  goal: StatsGoal;
  now?: Date;
}): { start: Date; end: Date | null } | null {
  switch (goal.kind) {
    case 'annual':
      if (goal.year == null) return null;
      return { start: new Date(goal.year, 0, 1), end: new Date(goal.year, 11, 31) };
    case 'custom': {
      const start = dayFromString(goal.startDate);
      const end = dayFromString(goal.endDate);
      if (!start || !end || start > end) return null;
      return { start, end };
    }
    default: {
      const created = goal.localCreatedAt ? new Date(goal.localCreatedAt) : null;
      const start =
        dayFromString(goal.startDate) ??
        (created && !Number.isNaN(created.getTime()) ? startOfDay(created) : startOfDay(now));
      const end = dayFromString(goal.endDate);
      if (end && end < start) return null;
      return { start, end };
    }
  }
}

/** The listed peaks reached; a peak matches by OSM node when both sides have one, else by name. */
export function peaksClimbed({
  peaks,
  record,
}: {
  peaks: readonly TripSummit[];
  record: ParksAndPeaks | null;
}): Set<string> {
  if (!record) return new Set();
  const osmIds = new Set(record.ascents.flatMap((ascent) => ascent.summit.osmId ?? []));
  const names = new Set(record.ascents.map((ascent) => normalizedPeakName(ascent.summit.name)));
  return new Set(
    peaks
      .filter(
        (peak) =>
          (peak.osmId != null && osmIds.has(peak.osmId)) ||
          names.has(normalizedPeakName(peak.name)),
      )
      .map(peakKey),
  );
}

/**
 * Null when the goal has no usable window, or names a long trail the app doesn't know, which the
 * server refuses anyway. `longTrailMeters` returns the metres walked on a trail, or null for an
 * unknown trail.
 */
export function computeGoalProgress({
  goal,
  finished,
  parksAndPeaks = null,
  longTrailMeters = () => null,
  now = new Date(),
}: {
  goal: StatsGoal;
  finished: readonly FinishedTrip[];
  parksAndPeaks?: ParksAndPeaks | null;
  longTrailMeters?: (trailCode: string) => number | null;
  now?: Date;
}): GoalProgress | null {
  const window = goalWindow({ goal, now });
  if (!window) return null;
  const today = startOfDay(now);

  let value: number;
  switch (goal.kind) {
    case 'longTrail': {
      const meters = goal.trailCode ? longTrailMeters(goal.trailCode) : null;
      if (meters == null) return null;
      value = meters;
      break;
    }
    case 'peakList':
      value = peaksClimbed({ peaks: goal.peaks ?? [], record: parksAndPeaks }).size;
      break;
    case 'parkList': {
      const listed = goal.parkCodes ? new Set(goal.parkCodes) : null;
      value = parksAndPeaks
        ? visitedParks(parksAndPeaks).filter((status) => listed?.has(status.park.code) ?? true)
            .length
        : 0;
      break;
    }
    default: {
      const span = { start: window.start, end: window.end ?? window.start };
      const totals = computeTotals(clipTrips({ trips: finished, window: span }));
      const byMetric: Record<TripGoalMetric, number> = {
        trips: totals.trips,
        nights: totals.nights,
        days: totals.days,
        distance: totals.distance ?? 0,
        elevation: totals.elevationGain ?? 0,
        summits: parksAndPeaks ? peaksSummitedBetween({ record: parksAndPeaks, window: span }) : 0,
        parks: parksAndPeaks ? parksVisitedBetween({ record: parksAndPeaks, window: span }) : 0,
      };
      value = byMetric[goal.metric];
    }
  }

  let phase: GoalPhase;
  let elapsed: number;
  if (today < window.start) {
    phase = 'upcoming';
    elapsed = 0;
  } else if (window.end && today > window.end) {
    phase = 'ended';
    elapsed = 1;
  } else if (window.end) {
    phase = 'active';
    const totalDays = differenceInCalendarDays(window.end, window.start) + 1;
    const gone = differenceInCalendarDays(today, window.start) + 1;
    elapsed = Math.min(Math.max(gone / Math.max(totalDays, 1), 0), 1);
  } else {
    phase = 'active';
    elapsed = 0;
  }

  return {
    goal,
    start: window.start,
    end: window.end,
    phase,
    value,
    elapsed,
    pace: computePace({ goal, phase, hasEnd: window.end != null, value, elapsed }),
  };
}

function computePace({
  goal,
  phase,
  hasEnd,
  value,
  elapsed,
}: {
  goal: StatsGoal;
  phase: GoalPhase;
  hasEnd: boolean;
  value: number;
  elapsed: number;
}): GoalPace | null {
  // Pace only means something while a dated window is open and the goal isn't met.
  if (phase !== 'active' || !hasEnd || value >= goal.target) return null;
  const difference = value - goal.target * elapsed;
  const measured = isMeasuredMetric(goal.metric);
  // Counts round to whole units; measured goals call 1% of target even.
  const tolerance = measured ? goal.target * 0.01 : 0.5;
  if (Math.abs(difference) < tolerance) return { kind: 'onPace' };
  const by = measured ? Math.abs(difference) : Math.round(Math.abs(difference));
  return difference > 0 ? { kind: 'ahead', by } : { kind: 'behind', by };
}

const KIND_ORDER = Object.freeze([
  'annual',
  'custom',
  'longTrail',
  'peakList',
  'parkList',
] as const);

/** Annual goals first, then custom by end date, then list goals; oldest first within a kind. */
export function sortGoals<T extends StatsGoal>(goals: readonly T[]): T[] {
  const time = (value?: string | null) => (value ? new Date(value).getTime() || 0 : 0);
  return [...goals].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.kind === 'custom' ? time(a.endDate) - time(b.endDate) : 0) ||
      time(a.localCreatedAt) - time(b.localCreatedAt),
  );
}
