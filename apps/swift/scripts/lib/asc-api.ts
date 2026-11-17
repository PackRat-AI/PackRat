import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { nodeEnv } from '@packrat/env/node';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';

export type Resource = { id: string; attributes?: Record<string, unknown> };
export type Doc = { data?: Resource | Resource[] | null; errors?: unknown[] };

export const resources = (doc: Doc): Resource[] => (Array.isArray(doc.data) ? doc.data : []);
export const one = (doc: Doc): Resource | null =>
  Array.isArray(doc.data) ? null : (doc.data ?? null);

/**
 * App Store Connect API client authenticated with an API key.
 *
 * Env:
 *   APPLE_ASC_API_KEY_ID     App Store Connect API key id
 *   APPLE_ASC_API_ISSUER_ID  App Store Connect API issuer id
 *   APPLE_ASC_API_KEY_PATH   Path to AuthKey_<id>.p8 (default:
 *                            ~/.appstoreconnect/private_keys/AuthKey_<id>.p8)
 *   ASC_APP_ID               App Store Connect app id (default: 6499243187)
 */
export function createAscClient() {
  const keyId = nodeEnv.APPLE_ASC_API_KEY_ID;
  const issuerId = nodeEnv.APPLE_ASC_API_ISSUER_ID;
  if (!keyId || !issuerId) {
    console.error('APPLE_ASC_API_KEY_ID and APPLE_ASC_API_ISSUER_ID are required.');
    process.exit(1);
  }
  const keyPath =
    nodeEnv.APPLE_ASC_API_KEY_PATH ??
    join(homedir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
  const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));
  const appId = nodeEnv.ASC_APP_ID || '6499243187';

  const b64 = (value: object) => Buffer.from(safeJsonStringify(value)).toString('base64url');

  // ES256 JWT; `ieee-p1363` gives the raw r||s signature JOSE expects (not DER).
  function token(): string {
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
    const body = b64({ iss: issuerId, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' });
    const signature = sign('sha256', Buffer.from(`${head}.${body}`), {
      key: privateKey,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');
    return `${head}.${body}.${signature}`;
  }

  // Apple's API returns sporadic 5xx under load; nothing persists on a 5xx, so retry.
  async function api(request: { method: string; path: string; body?: object }): Promise<Doc> {
    const { method, path, body } = request;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
        method,
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: body ? safeJsonStringify(body) : undefined,
      });
      const text = await res.text();
      const doc: Doc = text ? safeJsonParse<Doc>(text) : {};
      if (res.ok) return doc;
      if (res.status >= 500 && attempt < 5) {
        await Bun.sleep(attempt * 5000);
        continue;
      }
      throw new Error(`${method} ${path} → ${res.status} ${safeJsonStringify(doc.errors ?? text)}`);
    }
  }

  const get = (path: string) => api({ method: 'GET', path });

  return { appId, api, get };
}
