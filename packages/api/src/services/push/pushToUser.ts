import type { createDb } from '@packrat/api/db';
import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { userDeviceTokens } from '@packrat/db/schema';
import { eq } from 'drizzle-orm';
import type { PushPayload } from './pushPayload';
import { pushGateway, sendPush } from './sendPush';

type Db = ReturnType<typeof createDb>;

/**
 * Pushes one payload to every device of one user. Per-device failures don't
 * abort the batch; an expired token is deleted so the table self-cleans.
 */
export async function pushToUser({
  env,
  db,
  userId,
  payload,
  operation,
  extra,
}: {
  env: ValidatedEnv;
  db: Db;
  userId: string;
  payload: PushPayload;
  /** Sentry operation name for failures. */
  operation: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const tokens = await db
    .tag(`${operation}.listDeviceTokens`)
    .select({
      id: userDeviceTokens.id,
      platform: userDeviceTokens.platform,
      deviceToken: userDeviceTokens.deviceToken,
    })
    .from(userDeviceTokens)
    .where(eq(userDeviceTokens.userId, userId));

  for (const token of tokens) {
    try {
      const result = await sendPush({
        env,
        platform: token.platform,
        deviceToken: token.deviceToken,
        payload,
      });
      if (result.outcome === 'invalid-token') {
        await db
          .tag(`${operation}.deleteStaleDeviceToken`)
          .delete(userDeviceTokens)
          .where(eq(userDeviceTokens.id, token.id));
      } else if (result.outcome === 'error') {
        captureApiException({
          error: new Error(
            `${pushGateway(token.platform)} push failed: ${result.status} ${result.body}`,
          ),
          operation,
          extra: { ...extra, httpStatus: result.status },
        });
      }
    } catch (error) {
      captureApiException({ error, operation, extra });
    }
  }
}
