import type { ValidatedEnv } from '@packrat/api/utils/env-validation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `apnsClient` caches the signed JWT at module scope, so every test re-imports
 * the module through `loadClient()` to get a fresh cache. Without that, the
 * first test to mint a token would satisfy every later one and the caching
 * behaviour itself would be untestable.
 */
async function loadClient() {
  vi.resetModules();
  return import('../apnsClient');
}

// A real PKCS#8 P-256 key, generated for this test only and never used
// anywhere else — crypto.subtle.importKey rejects anything malformed, so a
// placeholder string would not exercise the signing path.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgbpFq/ywiXalhQFf7
KUajl6M6vqPDhxHrUC34TJ/HuKGhRANCAATp0Gwxg6GXUetoJJ71850cpuUU+T4Z
1JdBd4lMqa8/XaLWwyunUyQZdMkNa9nTnNbjeYAP4CNux7qBCijlG0ly
-----END PRIVATE KEY-----`;

const env = {
  APNS_KEY_ID: 'KEY123',
  APNS_TEAM_ID: 'TEAM456',
  APNS_BUNDLE_ID: 'com.packrat.app',
  APNS_PRIVATE_KEY: TEST_PRIVATE_KEY,
  APNS_ENVIRONMENT: 'sandbox',
} as unknown as ValidatedEnv;

function envWithout(key: keyof typeof env) {
  return { ...env, [key]: undefined } as unknown as ValidatedEnv;
}

const payload = {
  alert: { title: 'Flood Warning', body: 'Rising water expected' },
  weatherLocationId: 42,
};

function okResponse() {
  return new Response('', { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendApnsPush', () => {
  it('reports success on a 2xx from APNs', async () => {
    const { sendApnsPush } = await loadClient();

    const result = await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(result).toEqual({ outcome: 'sent' });
  });

  it('posts to the device path on the sandbox host outside production', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.sandbox.push.apple.com/3/device/device-1',
    );
  });

  it('posts to the production host when APNS_ENVIRONMENT is production', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({
      env: { ...env, APNS_ENVIRONMENT: 'production' } as unknown as ValidatedEnv,
      deviceToken: 'device-1',
      payload,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.push.apple.com/3/device/device-1');
  });

  it('sends the bundle id and high-priority alert headers APNs requires', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({ env, deviceToken: 'device-1', payload });

    const init = fetchMock.mock.calls[0]?.[1] as {
      method: string;
      headers: Record<string, string>;
    };
    expect(init.method).toBe('POST');
    expect(init.headers['apns-topic']).toBe('com.packrat.app');
    expect(init.headers['apns-push-type']).toBe('alert');
    expect(init.headers['apns-priority']).toBe('10');
  });

  it('builds an aps payload carrying the alert and the location id for deep-linking', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({ env, deviceToken: 'device-1', payload });

    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(init.body)).toEqual({
      aps: {
        alert: { title: 'Flood Warning', body: 'Rising water expected' },
        sound: 'default',
        badge: undefined,
      },
      weatherLocationId: 42,
    });
  });

  it('passes an explicit sound and badge through instead of the default', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({
      env,
      deviceToken: 'device-1',
      payload: { ...payload, sound: 'siren.caf', badge: 3 },
    });

    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(init.body).aps).toMatchObject({ sound: 'siren.caf', badge: 3 });
  });

  it('signs with an ES256 JWT naming the key id and team id', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({ env, deviceToken: 'device-1', payload });

    const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
    const jwt = init.headers.authorization?.replace('bearer ', '') ?? '';
    const [header, claims, signature] = jwt.split('.');

    expect(JSON.parse(atob(header ?? ''))).toEqual({ alg: 'ES256', kid: 'KEY123' });
    expect(JSON.parse(atob(claims ?? ''))).toMatchObject({ iss: 'TEAM456' });
    // ES256 signatures are a fixed 64 bytes (r‖s over P-256), which is 86
    // characters once base64url-encoded with the padding stripped.
    expect(signature).toHaveLength(86);
  });

  it('reuses one cached JWT across sends rather than minting per request', async () => {
    const { sendApnsPush } = await loadClient();

    await sendApnsPush({ env, deviceToken: 'device-1', payload });
    await sendApnsPush({ env, deviceToken: 'device-2', payload });

    const first = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
      .authorization;
    const second = (fetchMock.mock.calls[1]?.[1] as { headers: Record<string, string> }).headers
      .authorization;
    expect(second).toBe(first);
  });

  it('mints a fresh JWT once the cached one passes its TTL', async () => {
    vi.useFakeTimers();
    try {
      const { sendApnsPush } = await loadClient();

      await sendApnsPush({ env, deviceToken: 'device-1', payload });
      vi.advanceTimersByTime(56 * 60 * 1000);
      await sendApnsPush({ env, deviceToken: 'device-1', payload });

      const first = (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
        .authorization;
      const second = (fetchMock.mock.calls[1]?.[1] as { headers: Record<string, string> }).headers
        .authorization;
      expect(second).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flags a 410 Unregistered so the caller can drop the stale token', async () => {
    fetchMock.mockResolvedValue(new Response('Unregistered', { status: 410 }));
    const { sendApnsPush } = await loadClient();

    const result = await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(result).toEqual({ outcome: 'invalid-token' });
  });

  it('flags a 400 BadDeviceToken as an invalid token too', async () => {
    fetchMock.mockResolvedValue(new Response('{"reason":"BadDeviceToken"}', { status: 400 }));
    const { sendApnsPush } = await loadClient();

    const result = await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(result).toEqual({ outcome: 'invalid-token' });
  });

  it('reports an unrelated 400 as an error rather than dropping the token', async () => {
    fetchMock.mockResolvedValue(new Response('{"reason":"PayloadTooLarge"}', { status: 400 }));
    const { sendApnsPush } = await loadClient();

    const result = await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(result).toEqual({
      outcome: 'error',
      status: 400,
      body: '{"reason":"PayloadTooLarge"}',
    });
  });

  it('surfaces an APNs server error with its status and body', async () => {
    fetchMock.mockResolvedValue(new Response('InternalServerError', { status: 500 }));
    const { sendApnsPush } = await loadClient();

    const result = await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(result).toEqual({ outcome: 'error', status: 500, body: 'InternalServerError' });
  });

  it('still reports an error when the failure body cannot be read', async () => {
    const unreadable = new Response('', { status: 503 });
    vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('stream closed'));
    fetchMock.mockResolvedValue(unreadable);
    const { sendApnsPush } = await loadClient();

    const result = await sendApnsPush({ env, deviceToken: 'device-1', payload });

    expect(result).toEqual({ outcome: 'error', status: 503, body: '' });
  });

  it('refuses to send when the bundle id is unset', async () => {
    const { sendApnsPush } = await loadClient();

    await expect(
      sendApnsPush({ env: envWithout('APNS_BUNDLE_ID'), deviceToken: 'device-1', payload }),
    ).rejects.toThrow('APNS_BUNDLE_ID unset');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it.each([
    'APNS_KEY_ID',
    'APNS_TEAM_ID',
    'APNS_PRIVATE_KEY',
  ] as const)('refuses to sign when %s is unset', async (missing) => {
    const { sendApnsPush } = await loadClient();

    await expect(
      sendApnsPush({ env: envWithout(missing), deviceToken: 'device-1', payload }),
    ).rejects.toThrow('APNs is not configured');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
