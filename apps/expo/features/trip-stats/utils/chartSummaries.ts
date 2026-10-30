import type { ActivityBucket, MonthBucket, WeightPoint } from './tripStats';

/**
 * What each Trip Stats chart shows at a glance, for the summary a screen reader speaks before the
 * chart's own values, as Apple's audio graphs and Material's chart guidance both lead with.
 */

export function monthsSummary({
  months,
  metric,
}: {
  months: readonly MonthBucket[];
  metric: 'nights' | 'trips';
}): { total: number; peak: { month: Date; value: number } | null } {
  let total = 0;
  let peak: { month: Date; value: number } | null = null;
  for (const bucket of months) {
    const value = bucket[metric];
    total += value;
    if (value > 0 && (peak == null || value > peak.value)) peak = { month: bucket.month, value };
  }
  return { total, peak };
}

export function activitiesSummary(buckets: readonly ActivityBucket[]): {
  count: number;
  top: ActivityBucket | null;
} {
  const top = buckets.reduce<ActivityBucket | null>(
    (best, bucket) => (best == null || bucket.trips > best.trips ? bucket : best),
    null,
  );
  return { count: buckets.length, top };
}

export function weightSummary(points: readonly WeightPoint[]): {
  count: number;
  first: WeightPoint | null;
  last: WeightPoint | null;
} {
  return {
    count: points.length,
    first: points.length > 1 ? (points[0] ?? null) : null,
    last: points.length > 1 ? (points[points.length - 1] ?? null) : null,
  };
}
