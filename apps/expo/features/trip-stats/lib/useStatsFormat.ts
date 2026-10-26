import type { TripGoalMetric } from '@packrat/schemas/tripStats';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useCallback, useMemo } from 'react';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import type { Scope } from '../utils/tripStats';
import { formatDistance, formatElevation } from '../utils/units';

/** Short month-and-day, e.g. "Mar 4", in the device locale. */
export function formatMonthDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Full date, e.g. "Mar 4, 2026", in the device locale. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(undefined, { month: 'long' });
}

/** A whole number with grouping, e.g. "1,240". */
export function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** A rate or average to one decimal, dropped when whole: "2.5", "3". */
export function formatDecimal(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/** Month and year, e.g. "Mar 2026", in the device locale. */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** "A, B and C" in the device language where the engine has `Intl.ListFormat`. */
export function formatList(items: readonly string[]): string {
  if ('ListFormat' in Intl) {
    return new Intl.ListFormat(undefined, { style: 'long', type: 'conjunction' }).format(items);
  }
  return items.join(', ');
}

/** The scope in words: "Hiking in 2025", "Hiking", "2025" or "All Time". */
export function useScopeTitle(scope: Scope): string {
  const { t } = useTranslation();
  const activityName = scope.activity ? t(`tripStats.activities.names.${scope.activity}`) : null;
  if (scope.year != null && activityName) {
    return t('tripStats.scope.activityInYear', { activity: activityName, year: scope.year });
  }
  return activityName ?? (scope.year != null ? String(scope.year) : t('tripStats.totals.allTime'));
}

/** Formats goal metrics and counts in the user's units and language. */
export function useStatsFormat() {
  const { t } = useTranslation();
  const unit = useDistanceUnit();

  const formatMetric = useCallback(
    (metric: TripGoalMetric, value: number): string => {
      const count = Math.round(value);
      switch (metric) {
        case 'distance':
          return formatDistance({ metres: value, unit });
        case 'elevation':
          return formatElevation({ metres: value, unit });
        case 'trips':
          return t('tripStats.countTrips', { count });
        case 'nights':
          return t('tripStats.countNights', { count });
        case 'days':
          return t('tripStats.countDays', { count });
        case 'summits':
          return t('tripStats.countPeaks', { count });
        case 'parks':
          return t('tripStats.countParks', { count });
      }
    },
    [t, unit],
  );

  /** The number alone, for "12 of 20 nights". */
  const formatMetricValue = useCallback(
    (metric: TripGoalMetric, value: number): string => {
      const text = formatMetric(metric, value);
      const space = text.lastIndexOf(' ');
      return space > 0 ? text.slice(0, space) : text;
    },
    [formatMetric],
  );

  return useMemo(
    () => ({ unit, formatMetric, formatMetricValue }),
    [unit, formatMetric, formatMetricValue],
  );
}
