import type { WeatherAlertItem } from '@packrat/schemas/weather';

/**
 * A stable identifier for one alert within a location's active set. WeatherAPI
 * doesn't give alerts an id, so `event` + `effective` is the closest thing to
 * one — the same hazard re-issued with a new effective window is treated as a
 * different alert, which is correct: it's a new occurrence, not a continuation.
 */
export function alertId(alert: WeatherAlertItem): string {
  return `${alert.event}|${alert.effective}`;
}

/**
 * Deterministic hash of the active alert set, independent of array order —
 * WeatherAPI does not promise a stable ordering between polls, and treating a
 * reorder as a change would fire a notification for nothing new.
 */
export function alertSetHash(alerts: readonly WeatherAlertItem[]): string {
  return alerts.map(alertId).sort().join(',');
}

export type AlertDiff = {
  /** Alerts present now that were not in the previous active set. */
  newAlerts: WeatherAlertItem[];
  /** Ids that were active before and are no longer present. */
  resolvedIds: string[];
  /** Ids of every alert active now, for persisting as the new "last seen" set. */
  currentIds: string[];
  /** Hash of the current active set, for cheap change detection on the next poll. */
  hash: string;
};

/**
 * Diffs a location's freshly-fetched alerts against the ids seen on the
 * previous poll. Pure — no DB or network — so the polling cron's core
 * decision (notify on new, stay silent on resolved) is fully unit-testable
 * without mocking either.
 */
export function diffAlerts({
  previousIds,
  currentAlerts,
}: {
  previousIds: readonly string[];
  currentAlerts: readonly WeatherAlertItem[];
}): AlertDiff {
  const previousIdSet = new Set(previousIds);
  const currentIds = currentAlerts.map(alertId);
  const currentIdSet = new Set(currentIds);

  const newAlerts = currentAlerts.filter((alert) => !previousIdSet.has(alertId(alert)));
  const resolvedIds = previousIds.filter((id) => !currentIdSet.has(id));

  return {
    newAlerts,
    resolvedIds,
    currentIds,
    hash: alertSetHash(currentAlerts),
  };
}
