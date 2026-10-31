import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `fcmClient` caches the OAuth access token at module scope, so every test
 * re-imports the module through `loadClient()` to start with an empty cache.
 */
async function loadClient() {
  vi.resetModules();
  return import('../fcmClient');
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://fcm.googleapis.com/v1/projects/packrat-test/messages:send';

let env: ValidatedEnv;

// A real RSA key generated per run — importKey rejects anything malformed, so
// a placeholder would not exercise the signing path.
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const der = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const body = btoa(String.fromCharCode(...new Uint8Array(der)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  env = {
    FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: 'packrat-test',
      client_email: 'push@packrat-test.iam.gserviceaccount.com',
      private_key: pem,
    }),
  } as ValidatedEnv;
});

const weatherPayload = {
  alert: { title: 'Flood Warning', body: 'Rising water expected' },
  weatherLocationId: 42,
};

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: 'access-1', expires_in: 3600 }), {
    status: 200,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Routes the OAuth exchange and the send to separate canned responses. */
function stubFetch(send: () => Response) {
  fetchMock = vi.fn(async (url: string) => (url === TOKEN_URL ? tokenResponse() : send()));
  vi.stubGlobal('fetch', fetchMock);
}

function sendCalls() {
  return fetchMock.mock.calls.filter(([url]) => url === SEND_URL);
}

function sentMessage(callIndex = 0) {
  const init = sendCalls()[callIndex]?.[1] as RequestInit;
  return JSON.parse(String(init.body)).message;
}

beforeEach(() => {
  stubFetch(() => new Response('{}', { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendFcmPush', () => {
  it('reports success on a 2xx from FCM', async () => {
    const { sendFcmPush } = await loadClient();

    const result = await sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload });

    expect(result).toEqual({ outcome: 'sent' });
  });

  it('authenticates the send with the exchanged access token', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload });

    const init = sendCalls()[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ authorization: 'Bearer access-1' });
  });

  it('exchanges an RS256 assertion scoped to Firebase messaging', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload });

    const [, init] = fetchMock.mock.calls.find(([url]) => url === TOKEN_URL) ?? [];
    const form = new URLSearchParams(String((init as RequestInit).body));
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [header, claims] = (form.get('assertion') ?? '')
      .split('.')
      .slice(0, 2)
      .map((part) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))));
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims).toMatchObject({
      iss: 'push@packrat-test.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: TOKEN_URL,
    });
  });

  it('reuses the access token across sends', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload });
    await sendFcmPush({ env, deviceToken: 'device-2', payload: weatherPayload });

    expect(fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL)).toHaveLength(1);
    expect(sendCalls()).toHaveLength(2);
  });

  it('sends the alert as a high-priority notification on the alerts channel', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload });

    expect(sentMessage()).toEqual({
      token: 'device-1',
      notification: { title: 'Flood Warning', body: 'Rising water expected' },
      data: { weatherLocationId: '42' },
      android: { priority: 'HIGH', notification: { channel_id: 'alerts', sound: 'default' } },
    });
  });

  it('carries a trip id as string data', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({
      env,
      deviceToken: 'device-1',
      payload: { alert: { title: 'Trip', body: 'Storm' }, tripId: 'trip-9' },
    });

    expect(sentMessage().data).toEqual({ tripId: 'trip-9' });
  });

  it('carries the report id alongside its trip for a trail report', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({
      env,
      deviceToken: 'device-1',
      payload: { alert: { title: 'Trip', body: 'Ice' }, tripId: 'trip-9', reportId: 'report-3' },
    });

    expect(sentMessage().data).toEqual({ tripId: 'trip-9', reportId: 'report-3' });
  });

  it('carries a post id and badge count', async () => {
    const { sendFcmPush } = await loadClient();

    await sendFcmPush({
      env,
      deviceToken: 'device-1',
      payload: { alert: { title: 'Reply', body: 'Hi' }, postId: 7, badge: 3, sound: 'ping' },
    });

    expect(sentMessage().data).toEqual({ postId: '7' });
    expect(sentMessage().android.notification).toEqual({
      channel_id: 'alerts',
      sound: 'ping',
      notification_count: 3,
    });
  });

  it('flags an unregistered token for deletion', async () => {
    stubFetch(
      () =>
        new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', {
          status: 404,
        }),
    );
    const { sendFcmPush } = await loadClient();

    const result = await sendFcmPush({ env, deviceToken: 'dead', payload: weatherPayload });

    expect(result).toEqual({ outcome: 'invalid-token' });
  });

  it('flags a malformed registration token for deletion', async () => {
    stubFetch(
      () =>
        new Response(
          '{"error":{"message":"The registration token is not a valid FCM registration token"}}',
          {
            status: 400,
          },
        ),
    );
    const { sendFcmPush } = await loadClient();

    const result = await sendFcmPush({ env, deviceToken: 'junk', payload: weatherPayload });

    expect(result).toEqual({ outcome: 'invalid-token' });
  });

  it('reports any other failure as an error without deleting the token', async () => {
    stubFetch(() => new Response('quota', { status: 429 }));
    const { sendFcmPush } = await loadClient();

    const result = await sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload });

    expect(result).toEqual({ outcome: 'error', status: 429, body: 'quota' });
  });

  it('throws when the token exchange is refused', async () => {
    fetchMock = vi.fn(async () => new Response('invalid_grant', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendFcmPush } = await loadClient();

    await expect(
      sendFcmPush({ env, deviceToken: 'device-1', payload: weatherPayload }),
    ).rejects.toThrow('FCM OAuth token exchange failed: 400 invalid_grant');
  });

  it('throws when FCM is not configured', async () => {
    const { sendFcmPush } = await loadClient();

    await expect(
      sendFcmPush({ env: {} as ValidatedEnv, deviceToken: 'd', payload: weatherPayload }),
    ).rejects.toThrow('FCM is not configured');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('throws when the service account is incomplete', async () => {
    const { sendFcmPush } = await loadClient();
    const partial = { FCM_SERVICE_ACCOUNT_JSON: '{"project_id":"p"}' } as ValidatedEnv;

    await expect(
      sendFcmPush({ env: partial, deviceToken: 'd', payload: weatherPayload }),
    ).rejects.toThrow('missing project_id, client_email or private_key');
  });
});
