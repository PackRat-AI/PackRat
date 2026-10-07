import { createDbClient } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { userDeviceTokens } from '@packrat/db/schema';
import type { WeatherAlertItem } from '@packrat/schemas/weather';
import { eq } from 'drizzle-orm';
import { sendApnsPush } from './apnsClient';

export function tripAlertNotification({
  tripName,
  placeName,
  alerts,
}: {
  tripName: string;
  placeName: string | null;
  alerts: WeatherAlertItem[];
}): { title: string; body: string } {
  const place = placeName ? ` near ${placeName}` : ' at your destination';
  const events = [...new Set(alerts.map((a) => a.event))];
  const what = events.length === 1 ? `${events[0]} has` : `${events.join(', ')} have`;
  return {
    title: `Weather alert for ${tripName}`,
    body: `${what} been issued${place}. Check the forecast before you go.`,
  };
}

/**
 * Pushes a trip-destination weather alert to every device of the trip's owner.
 * The payload carries `tripId`, so a tap opens the trip. Per-device failures
 * don't abort the batch; an expired token is deleted, as in notifyWatchers.
 */
export async function notifyTripOwner({
  env,
  userId,
  tripId,
  tripName,
  placeName,
  newAlerts,
}: {
  env: ValidatedEnv;
  userId: string;
  tripId: string;
  tripName: string;
  placeName: string | null;
  newAlerts: WeatherAlertItem[];
}): Promise<void> {
  if (newAlerts.length === 0) return;
  const db = createDbClient(env);

  const tokens = await db
    .tag('tripReminders.listDeviceTokensForOwner')
    .select({ id: userDeviceTokens.id, deviceToken: userDeviceTokens.deviceToken })
    .from(userDeviceTokens)
    .where(eq(userDeviceTokens.userId, userId));

  const alert = tripAlertNotification({ tripName, placeName, alerts: newAlerts });

  for (const token of tokens) {
    try {
      const result = await sendApnsPush({
        env,
        deviceToken: token.deviceToken,
        payload: { alert, tripId },
      });
      if (result.outcome === 'invalid-token') {
        await db
          .tag('tripReminders.deleteStaleDeviceToken')
          .delete(userDeviceTokens)
          .where(eq(userDeviceTokens.id, token.id));
      } else if (result.outcome === 'error') {
        captureApiException({
          error: new Error(`APNs push failed: ${result.status} ${result.body}`),
          operation: 'tripReminders.notifyTripOwner',
          tags: { feature: 'tripReminders' },
          extra: { tripId, httpStatus: result.status },
        });
      }
    } catch (error) {
      captureApiException({
        error,
        operation: 'tripReminders.notifyTripOwner',
        tags: { feature: 'tripReminders' },
        extra: { tripId },
      });
    }
  }
}
