import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { userDeviceTokens, weatherWatchedLocations } from '@packrat/db/schema';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { eq, inArray } from 'drizzle-orm';
import { sendApnsPush } from './apnsClient';

function alertNotificationBody(alerts: WeatherAlertItem[]): { title: string; body: string } {
  const first = alerts[0];
  if (!first) return { title: 'Weather Alert', body: 'A new weather alert was issued.' };
  if (alerts.length === 1) {
    return { title: first.event, body: first.headline || first.desc };
  }
  return {
    title: `${alerts.length} new weather alerts`,
    body: alerts.map((a) => a.event).join(', '),
  };
}

/**
 * Pushes a notification to every device belonging to every user watching
 * `weatherLocationId`, for the newly-detected alert(s) only. Called from the
 * polling cron's diff step — never for a resolved alert (see
 * docs/features/weather-alerts.md ADR-004).
 *
 * Per-device failures don't abort the batch: an expired token is deleted so
 * the table self-cleans, and any other failure is captured and skipped.
 */
export async function notifyWatchers({
  env,
  weatherLocationId,
  newAlerts,
}: {
  env: ValidatedEnv;
  weatherLocationId: number;
  newAlerts: WeatherAlertItem[];
}): Promise<void> {
  if (newAlerts.length === 0) return;

  const db = createDbClient(env);

  const watchers = await db
    .tag('weatherMonitoring.listWatchersForLocation')
    .selectDistinct({ userId: weatherWatchedLocations.userId })
    .from(weatherWatchedLocations)
    .where(eq(weatherWatchedLocations.weatherLocationId, weatherLocationId));
  if (watchers.length === 0) return;

  const watcherIds = watchers.map((w) => w.userId);
  const tokens = await db
    .tag('weatherMonitoring.listDeviceTokensForWatchers')
    .select({ id: userDeviceTokens.id, deviceToken: userDeviceTokens.deviceToken })
    .from(userDeviceTokens)
    .where(inArray(userDeviceTokens.userId, watcherIds));

  const { title, body } = alertNotificationBody(newAlerts);

  for (const token of tokens) {
    try {
      const result = await sendApnsPush({
        env,
        deviceToken: token.deviceToken,
        payload: { alert: { title, body }, weatherLocationId },
      });

      if (result.outcome === 'invalid-token') {
        await db
          .tag('weatherMonitoring.deleteStaleDeviceToken')
          .delete(userDeviceTokens)
          .where(eq(userDeviceTokens.id, token.id));
      } else if (result.outcome === 'error') {
        captureApiException({
          error: new Error(`APNs push failed: ${result.status} ${result.body}`),
          operation: 'weatherMonitoring.notifyWatchers',
          tags: { feature: 'weatherMonitoring' },
          extra: { weatherLocationId, httpStatus: result.status },
        });
      }
    } catch (error) {
      captureApiException({
        error,
        operation: 'weatherMonitoring.notifyWatchers',
        tags: { feature: 'weatherMonitoring' },
        extra: { weatherLocationId },
      });
    }
  }
}
