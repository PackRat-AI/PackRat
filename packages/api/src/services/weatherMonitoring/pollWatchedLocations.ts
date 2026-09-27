import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { weatherLocationAlertState, weatherWatchedLocations } from '@packrat/db/schema';
import { notifyWatchers } from '../push/notifyWatchers';
import { diffAlerts } from './diffAlerts';
import { fetchLocationAlerts } from './fetchLocationAlerts';

const BASELINE_INTERVAL_MS = 20 * 60 * 1000;
const ELEVATED_INTERVAL_MS = 5 * 60 * 1000;

export type PollResult = {
  /** Distinct watched locations considered this run. */
  checked: number;
  /** Locations skipped because their poll interval hasn't elapsed yet. */
  skipped: number;
  /** Locations that failed to fetch or diff; the run continues past these. */
  failed: number;
  /** Locations where at least one new alert triggered a notification. */
  notified: number;
};

/**
 * One pass of the watched-location polling cron: for each distinct
 * WeatherAPI location any user is watching, fetch its current alerts (if due,
 * per its poll tier), diff against last-seen state, and notify watchers only
 * on a new or changed alert. Never pushes on resolution — see
 * docs/features/weather-alerts.md ADR-004.
 *
 * Locations are deduped across users: N users watching the same place costs
 * one WeatherAPI call, not N.
 */
export async function pollWatchedLocations({ env }: { env: ValidatedEnv }): Promise<PollResult> {
  const db = createDbClient(env);
  const now = new Date();

  const distinctLocations = await db
    .tag('weatherMonitoring.listDistinctWatchedLocations')
    .selectDistinct({ weatherLocationId: weatherWatchedLocations.weatherLocationId })
    .from(weatherWatchedLocations);

  const states = await db
    .tag('weatherMonitoring.listAlertState')
    .select({
      weatherLocationId: weatherLocationAlertState.weatherLocationId,
      lastAlertIds: weatherLocationAlertState.lastAlertIds,
      pollTier: weatherLocationAlertState.pollTier,
      lastPolledAt: weatherLocationAlertState.lastPolledAt,
      activeSince: weatherLocationAlertState.activeSince,
    })
    .from(weatherLocationAlertState);
  const stateByLocation = new Map(states.map((s) => [s.weatherLocationId, s]));

  const result: PollResult = { checked: 0, skipped: 0, failed: 0, notified: 0 };

  for (const { weatherLocationId } of distinctLocations) {
    const state = stateByLocation.get(weatherLocationId);
    const intervalMs = state?.pollTier === 'elevated' ? ELEVATED_INTERVAL_MS : BASELINE_INTERVAL_MS;
    const dueAt = state?.lastPolledAt ? state.lastPolledAt.getTime() + intervalMs : 0;

    if (now.getTime() < dueAt) {
      result.skipped++;
      continue;
    }

    result.checked++;

    try {
      const currentAlerts = await fetchLocationAlerts(weatherLocationId);
      const diff = diffAlerts({
        previousIds: state?.lastAlertIds ?? [],
        currentAlerts,
      });

      const hasActiveAlerts = diff.currentIds.length > 0;
      const wasAlreadyActive = state?.pollTier === 'elevated';
      // Only stamp a fresh activeSince the moment a location goes from
      // clear to active; a still-active location keeps its original
      // activeSince rather than resetting it on every poll.
      const activeSince = hasActiveAlerts ? (wasAlreadyActive ? state?.activeSince : now) : null;

      await db
        .tag('weatherMonitoring.upsertAlertState')
        .insert(weatherLocationAlertState)
        .values({
          weatherLocationId,
          lastAlertHash: diff.hash,
          lastAlertIds: diff.currentIds,
          pollTier: hasActiveAlerts ? 'elevated' : 'baseline',
          activeSince,
          lastPolledAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: weatherLocationAlertState.weatherLocationId,
          set: {
            lastAlertHash: diff.hash,
            lastAlertIds: diff.currentIds,
            pollTier: hasActiveAlerts ? 'elevated' : 'baseline',
            activeSince,
            lastPolledAt: now,
            updatedAt: now,
          },
        });

      if (diff.newAlerts.length > 0) {
        await notifyWatchers({ env, weatherLocationId, newAlerts: diff.newAlerts });
        result.notified++;
      }
    } catch (error) {
      result.failed++;
      captureApiException({
        error,
        operation: 'weatherMonitoring.pollLocation',
        tags: { feature: 'weatherMonitoring' },
        extra: { weatherLocationId },
      });
    }
  }

  return result;
}
