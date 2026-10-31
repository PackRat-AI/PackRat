import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { weatherLocationAlertState } from '@packrat/db/schema';
import { eq } from 'drizzle-orm';
import { notifyWatchers } from '../push/notifyWatchers';
import { alertId } from './diffAlerts';
import { fetchLocationAlerts } from './fetchLocationAlerts';

/**
 * A place's timer announces each alert once, to whoever watches the place at
 * that moment, so someone who starts watching while an alert is in effect
 * would otherwise never hear about it. This tells only the new watcher about
 * the alerts the timer has already announced. Alerts the timer hasn't seen yet
 * are left to it: it will tell every watcher, this one included, and nobody
 * gets the same alert twice.
 */
export async function announceActiveAlertsToNewWatcher({
  env,
  userId,
  weatherLocationId,
}: {
  env: ValidatedEnv;
  userId: string;
  weatherLocationId: number;
}): Promise<void> {
  const db = createDbClient(env);
  const [state] = await db
    .tag('weatherMonitoring.getAnnouncedAlertIds')
    .select({ lastAlertIds: weatherLocationAlertState.lastAlertIds })
    .from(weatherLocationAlertState)
    .where(eq(weatherLocationAlertState.weatherLocationId, weatherLocationId));

  const announced = new Set(state?.lastAlertIds ?? []);
  if (announced.size === 0) return;

  const alerts = await fetchLocationAlerts(weatherLocationId);
  const stillActive = alerts.filter((alert) => announced.has(alertId(alert)));
  if (stillActive.length === 0) return;

  await notifyWatchers({
    env,
    weatherLocationId,
    newAlerts: stillActive,
    onlyUserIds: [userId],
  });
}
