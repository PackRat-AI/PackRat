import type { TripActivity } from '@packrat/schemas/trips';
import { first } from '@packrat/utils';
import { addMonths } from 'date-fns';
import { type GoalProgress, isGoalComplete } from './goalProgress';
import { type Ascent, type NationalPark, type ParksAndPeaks, peakKey } from './parksAndPeaks';
import { distanceMeters } from './polyline';
import {
  type ActivityBucket,
  clipTrips,
  computeTotals,
  type FinishedTrip,
  type MonthBucket,
  type Totals,
} from './tripStats';

/**
 * One calendar year of finished trips, told as a short sequence of cards: totals, busiest month,
 * longest trip, new places, summits and goals met. Ported from the Swift app's `YearInReview`, so
 * both platforms tell the same year.
 *
 * Offered in December (for the year closing) and January (for the year just gone), the Strava
 * Year in Sport / Spotify Wrapped window. Trips crossing New Year count in the year they started,
 * clipped to 31 December.
 */

export const REVIEW_PAGES = Object.freeze([
  'intro',
  'totals',
  'busiestMonth',
  'longestTrip',
  'newPlaces',
  'summits',
  'goals',
  'summary',
] as const);

export type ReviewPage = (typeof REVIEW_PAGES)[number];

export interface YearInReview {
  year: number;
  totals: Totals;
  /** January through December, including empty months. */
  months: MonthBucket[];
  busiestMonth: MonthBucket | null;
  longestTrip: FinishedTrip | null;
  farthestTrip: FinishedTrip | null;
  /** Trips per activity, busiest first. */
  activities: ActivityBucket[];
  /** Places reached for the first time this year: more than a kilometre from every earlier trip. */
  newPlaces: number;
  /** National Parks first visited this year, by first visit. */
  newParks: NationalPark[];
  /** Summits reached this year, newest first. */
  summits: Ascent[];
  peakCount: number;
  highest: Ascent | null;
  /** Goals for this year, or ending in it, that were met. */
  goalsMet: GoalProgress[];
}

/** The pages worth showing: a page with nothing to say is left out. */
export function reviewPages(review: YearInReview): ReviewPage[] {
  return REVIEW_PAGES.filter((page) => {
    switch (page) {
      case 'busiestMonth':
        return review.busiestMonth != null && review.totals.trips > 1;
      case 'longestTrip':
        return review.longestTrip != null || review.farthestTrip != null;
      case 'newPlaces':
        return review.newPlaces > 0 || review.newParks.length > 0;
      case 'summits':
        return review.peakCount > 0;
      case 'goals':
        return review.goalsMet.length > 0;
      default:
        return true;
    }
  });
}

/**
 * The year on offer today: December offers the year closing, January the year just gone, other
 * months nothing. `force` (debug builds) offers the current year at any time.
 */
export function offeredReviewYear({ now, force = false }: { now: Date; force?: boolean }) {
  const year = now.getFullYear();
  switch (now.getMonth()) {
    case 11:
      return year;
    case 0:
      return force ? year : year - 1;
    default:
      return force ? year : null;
  }
}

const NEW_PLACE_METRES = 1_000;

/** Null when the year holds no finished trips. */
export function computeYearInReview({
  year,
  finished,
  parksAndPeaks,
  goals,
}: {
  year: number;
  /** Every finished trip, any year, oldest first. */
  finished: readonly FinishedTrip[];
  parksAndPeaks: ParksAndPeaks;
  goals: readonly GoalProgress[];
}): YearInReview | null {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const inYear = clipTrips({ trips: finished, window: { start, end } });
  if (inYear.length === 0) return null;

  const months: MonthBucket[] = Array.from({ length: 12 }, (_, offset) => ({
    month: addMonths(start, offset),
    trips: 0,
    nights: 0,
  }));
  for (const trip of inYear) {
    const bucket = months[trip.start.getMonth()];
    if (!bucket) continue;
    bucket.trips += 1;
    bucket.nights += trip.nights;
  }
  // By nights, then trips; remaining ties go to the earlier month.
  const busiestMonth =
    first(
      months
        .filter((month) => month.trips > 0)
        .sort((a, b) => b.nights - a.nights || b.trips - a.trips),
    ) ?? null;

  // Biggest first; `inYear` is oldest first and the sort is stable, so ties go to the earlier trip.
  const distanceOf = (trip: FinishedTrip) => trip.trip.log?.distanceMeters ?? 0;
  const longestTrip =
    first(inYear.filter((trip) => trip.nights > 0).sort((a, b) => b.nights - a.nights)) ?? null;
  const farthestTrip =
    first(
      inYear.filter((trip) => distanceOf(trip) > 0).sort((a, b) => distanceOf(b) - distanceOf(a)),
    ) ?? null;

  const byActivity = new Map<TripActivity, ActivityBucket>();
  for (const trip of inYear) {
    for (const activity of new Set(trip.trip.log?.activities ?? [])) {
      const bucket = byActivity.get(activity) ?? { activity, trips: 0, nights: 0, distance: 0 };
      bucket.trips += 1;
      bucket.nights += trip.nights;
      bucket.distance += distanceOf(trip);
      byActivity.set(activity, bucket);
    }
  }

  const seen = finished.flatMap((trip) =>
    trip.start < start && trip.trip.location ? [trip.trip.location] : [],
  );
  let newPlaces = 0;
  for (const trip of inYear) {
    const location = trip.trip.location;
    if (!location) continue;
    if (seen.some((place) => distanceMeters({ from: place, to: location }) < NEW_PLACE_METRES))
      continue;
    seen.push(location);
    newPlaces += 1;
  }

  const newParks = parksAndPeaks.parks
    .flatMap((status) => {
      const firstVisit = status.visits.find((visit) => visit.date != null)?.date;
      return firstVisit && firstVisit >= start && firstVisit <= end
        ? [{ park: status.park, firstVisit }]
        : [];
    })
    .sort((a, b) => a.firstVisit.getTime() - b.firstVisit.getTime())
    .map((item) => item.park);

  const summits = parksAndPeaks.ascents.filter(
    (ascent) => ascent.date != null && ascent.date >= start && ascent.date <= end,
  );
  const highest =
    first(
      summits
        .filter((ascent) => ascent.summit.elevationMeters != null)
        .sort((a, b) => (b.summit.elevationMeters ?? 0) - (a.summit.elevationMeters ?? 0)),
    ) ?? null;

  const goalsMet = goals.filter((progress) => {
    if (!isGoalComplete(progress)) return false;
    if (progress.goal.kind === 'annual') return progress.goal.year === year;
    // Dated goals count in the year they end; open-ended list goals in the year they started.
    return (progress.end ?? progress.start).getFullYear() === year;
  });

  return {
    year,
    totals: computeTotals(inYear),
    months,
    busiestMonth,
    longestTrip,
    farthestTrip,
    activities: [...byActivity.values()].sort(
      (a, b) => b.trips - a.trips || a.activity.localeCompare(b.activity),
    ),
    newPlaces,
    newParks,
    summits,
    peakCount: new Set(summits.map((ascent) => peakKey(ascent.summit))).size,
    highest,
    goalsMet,
  };
}
