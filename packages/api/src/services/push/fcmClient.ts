import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import {
  type FcmServiceAccount,
  FcmServiceAccountSchema,
  GoogleAccessTokenResponseSchema,
} from '@packrat/schemas/push';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import type { PushPayload } from './pushPayload';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const PEM_HEADER_REGEX = /-----BEGIN PRIVATE KEY-----/;
const PEM_FOOTER_REGEX = /-----END PRIVATE KEY-----/;
const PEM_WHITESPACE_REGEX = /\s+/g;
const BASE64_PLUS_REGEX = /\+/g;
const BASE64_SLASH_REGEX = /\//g;
const BASE64_PADDING_REGEX = /=+$/;

/** Android notification channel the app creates for alert-style pushes. */
export const FCM_ALERTS_CHANNEL_ID = 'alerts';

// Google access tokens last an hour. Refreshed five minutes early so a token
// never expires mid-flight.
const TOKEN_SAFETY_MS = 5 * 60 * 1000;

let cachedToken: { token: string; expiresAt: number } | null = null;

function readServiceAccount(env: ValidatedEnv): FcmServiceAccount {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FCM is not configured (FCM_SERVICE_ACCOUNT_JSON unset)');
  const parsed = FcmServiceAccountSchema.safeParse(safeJsonParse(raw));
  if (!parsed.success) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key');
  }
  return parsed.data;
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin)
    .replace(BASE64_PLUS_REGEX, '-')
    .replace(BASE64_SLASH_REGEX, '_')
    .replace(BASE64_PADDING_REGEX, '');
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

async function importServiceAccountKey(pkcs8Pem: string): Promise<CryptoKey> {
  const pemBody = pkcs8Pem
    .replace(PEM_HEADER_REGEX, '')
    .replace(PEM_FOOTER_REGEX, '')
    .replace(PEM_WHITESPACE_REGEX, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/**
 * Exchanges a service-account-signed RS256 assertion for an OAuth access
 * token (Google's two-legged JWT bearer flow), cached per isolate. Done with
 * Web Crypto rather than `firebase-admin`, which needs Node APIs workerd
 * does not have — the same reasoning as `apnsClient`.
 */
async function getAccessToken(account: FcmServiceAccount): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const iat = Math.floor(now / 1000);
  const header = base64UrlEncodeString(safeJsonStringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlEncodeString(
    safeJsonStringify({
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: OAUTH_TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const key = await importServiceAccountKey(account.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`FCM OAuth token exchange failed: ${response.status} ${body}`);
  }
  const { access_token, expires_in } = GoogleAccessTokenResponseSchema.parse(await response.json());

  cachedToken = { token: access_token, expiresAt: now + expires_in * 1000 - TOKEN_SAFETY_MS };
  return access_token;
}

/** FCM `data` values must all be strings; the app routes a tap by whichever id is present. */
function routingData(payload: PushPayload): Record<string, string> {
  if ('weatherLocationId' in payload)
    return { weatherLocationId: String(payload.weatherLocationId) };
  if ('tripId' in payload)
    return { tripId: payload.tripId, ...(payload.reportId ? { reportId: payload.reportId } : {}) };
  return { postId: String(payload.postId) };
}

/**
 * FCM reports a dead token as 404 `UNREGISTERED`, or as 400
 * `INVALID_ARGUMENT` naming the registration token. Any other 400 is a
 * payload bug and must not delete the row.
 */
function isInvalidTokenResponse({ status, body }: { status: number; body: string }): boolean {
  if (status === 404 && body.includes('UNREGISTERED')) return true;
  return status === 400 && body.includes('registration token');
}

export type FcmSendResult =
  | { outcome: 'sent' }
  | { outcome: 'invalid-token' }
  | { outcome: 'error'; status: number; body: string };

/** Sends one push to one Android device via the FCM HTTP v1 API. */
export async function sendFcmPush({
  env,
  deviceToken,
  payload,
}: {
  env: ValidatedEnv;
  deviceToken: string;
  payload: PushPayload;
}): Promise<FcmSendResult> {
  const account = readServiceAccount(env);
  const accessToken = await getAccessToken(account);

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: safeJsonStringify({
        message: {
          token: deviceToken,
          notification: payload.alert,
          data: routingData(payload),
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: FCM_ALERTS_CHANNEL_ID,
              sound: payload.sound ?? 'default',
              ...(payload.badge !== undefined ? { notification_count: payload.badge } : {}),
            },
          },
        },
      }),
    },
  );

  if (response.ok) return { outcome: 'sent' };

  const body = await response.text().catch(() => '');
  if (isInvalidTokenResponse({ status: response.status, body }))
    return { outcome: 'invalid-token' };
  return { outcome: 'error', status: response.status, body };
}
