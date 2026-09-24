import type { ValidatedEnv } from '@packrat/api/utils/env-validation';

const PRODUCTION_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
const PEM_HEADER_REGEX = /-----BEGIN PRIVATE KEY-----/;
const PEM_FOOTER_REGEX = /-----END PRIVATE KEY-----/;
const PEM_WHITESPACE_REGEX = /\s+/g;
const BASE64_PLUS_REGEX = /\+/g;
const BASE64_SLASH_REGEX = /\//g;
const BASE64_PADDING_REGEX = /=+$/;

// APNs tokens are valid up to an hour; Apple's own guidance is to reuse one
// rather than minting per-request. Refreshed a minute early so a token never
// expires mid-flight.
const TOKEN_TTL_MS = 55 * 60 * 1000;

let cachedToken: { token: string; expiresAt: number } | null = null;

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

async function importApnsSigningKey(pkcs8Pem: string): Promise<CryptoKey> {
  const pemBody = pkcs8Pem
    .replace(PEM_HEADER_REGEX, '')
    .replace(PEM_FOOTER_REGEX, '')
    .replace(PEM_WHITESPACE_REGEX, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

/**
 * Builds (and caches) the ES256 JWT APNs requires as a bearer token —
 * signed with the Apple Auth Key, not tied to any one device. Cloudflare
 * Workers has no persistent process to hold module-level cache across
 * isolates reliably, so this is a best-effort cache: worst case, a cold
 * isolate mints one extra token, which APNs allows without rate-limiting.
 */
async function getApnsJwt(env: ValidatedEnv): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY } = env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    throw new Error('APNs is not configured (APNS_KEY_ID/APNS_TEAM_ID/APNS_PRIVATE_KEY unset)');
  }

  const header = base64UrlEncodeString(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }));
  const payload = base64UrlEncodeString(
    JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(now / 1000) }),
  );
  const signingInput = `${header}.${payload}`;

  const key = await importApnsSigningKey(APNS_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  const token = `${signingInput}.${base64UrlEncode(signature)}`;
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS };
  return token;
}

export type ApnsSendResult =
  | { outcome: 'sent' }
  | { outcome: 'invalid-token' } // APNs 410 Unregistered / 400 BadDeviceToken — caller should delete the row
  | { outcome: 'error'; status: number; body: string };

/**
 * Sends one push to one device via APNs' HTTP/2 API. Cloudflare's `fetch`
 * multiplexes HTTP/2 automatically — no persistent-socket APNs library is
 * needed, matching this repo's preference for Workers-native primitives
 * over Node-only SDKs (see record() vs @elysiajs/opentelemetry).
 */
export async function sendApnsPush({
  env,
  deviceToken,
  payload,
}: {
  env: ValidatedEnv;
  deviceToken: string;
  payload: {
    alert: { title: string; body: string };
    sound?: string;
    badge?: number;
    weatherLocationId: number;
  };
}): Promise<ApnsSendResult> {
  const { APNS_BUNDLE_ID, APNS_ENVIRONMENT } = env;
  if (!APNS_BUNDLE_ID) throw new Error('APNs is not configured (APNS_BUNDLE_ID unset)');

  const host = APNS_ENVIRONMENT === 'production' ? PRODUCTION_HOST : SANDBOX_HOST;
  const jwt = await getApnsJwt(env);

  const response = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: {
        alert: payload.alert,
        sound: payload.sound ?? 'default',
        badge: payload.badge,
      },
      weatherLocationId: payload.weatherLocationId,
    }),
  });

  if (response.ok) return { outcome: 'sent' };

  const body = await response.text().catch(() => '');
  if (response.status === 410 || (response.status === 400 && body.includes('BadDeviceToken'))) {
    return { outcome: 'invalid-token' };
  }
  return { outcome: 'error', status: response.status, body };
}
