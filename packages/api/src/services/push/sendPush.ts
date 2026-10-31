import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import type { UserDeviceToken } from '@packrat/db/schema';
import { sendApnsPush } from './apnsClient';
import { sendFcmPush } from './fcmClient';
import type { PushPayload } from './pushPayload';

export type PushSendResult =
  | { outcome: 'sent' }
  | { outcome: 'invalid-token' } // caller should delete the row
  | { outcome: 'error'; status: number; body: string };

/** Gateway name for error messages and Sentry context. */
export function pushGateway(platform: UserDeviceToken['platform']): 'APNs' | 'FCM' {
  return platform === 'android' ? 'FCM' : 'APNs';
}

/** Delivers one push to one device through the gateway its platform uses. */
export function sendPush({
  env,
  platform,
  deviceToken,
  payload,
}: {
  env: ValidatedEnv;
  platform: UserDeviceToken['platform'];
  deviceToken: string;
  payload: PushPayload;
}): Promise<PushSendResult> {
  return platform === 'android'
    ? sendFcmPush({ env, deviceToken, payload })
    : sendApnsPush({ env, deviceToken, payload });
}
