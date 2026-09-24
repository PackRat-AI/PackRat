import { createDb } from '@packrat/api/db';
import { captureApiException } from '@packrat/api/utils/sentry';
import { userDeviceTokens } from '@packrat/db/schema';
import type { RegisterDeviceTokenRequest } from '@packrat/schemas/weatherMonitoring';

/**
 * Registers (or refreshes) a device's push token. Idempotent on
 * (userId, deviceToken) — the same physical device re-registering (app
 * relaunch, token unchanged) just bumps lastSeenAt rather than erroring.
 */
export async function registerDeviceToken({
  userId,
  request,
}: {
  userId: string;
  request: RegisterDeviceTokenRequest;
}): Promise<void> {
  const db = createDb();
  try {
    await db
      .tag('weatherMonitoring.registerDeviceToken')
      .insert(userDeviceTokens)
      .values({
        id: crypto.randomUUID(),
        userId,
        platform: request.platform,
        deviceToken: request.deviceToken,
      })
      .onConflictDoUpdate({
        target: [userDeviceTokens.userId, userDeviceTokens.deviceToken],
        set: { lastSeenAt: new Date() },
      });
  } catch (error) {
    captureApiException({
      error,
      operation: 'weatherMonitoring.registerDeviceToken',
      userId,
      tags: { feature: 'weatherMonitoring' },
    });
    throw error;
  }
}
