// CF Access client-side utilities for the admin SPA.
//
// CF Access protects the admin app in production. After authentication, CF sets
// an HttpOnly cookie (not readable by JS). The identity endpoint at
// /cdn-cgi/access/get-identity returns the signed JWT assertion we can forward
// to the API for cryptographic verification.

export type CFAccessIdentityResponse = {
  email: string;
  name: string;
  jwt: string;
};

// Cache the in-flight Promise — all concurrent callers share one network request.
// Avoids thundering-herd on first render when multiple components call simultaneously.
let identityPromise: Promise<CFAccessIdentityResponse | null> | undefined;

function fetchIdentity(): Promise<CFAccessIdentityResponse | null> {
  return fetch('/cdn-cgi/access/get-identity', { credentials: 'include' })
    .then((res) => {
      if (!res.ok) return null;
      return res.json() as Promise<unknown>;
    })
    .then((data) => {
      if (
        typeof data !== 'object' ||
        data === null ||
        typeof (data as Record<string, unknown>).email !== 'string' ||
        typeof (data as Record<string, unknown>).jwt !== 'string'
      ) {
        return null;
      }
      const d = data as { email: string; name?: string; jwt: string };
      return { email: d.email, name: d.name ?? '', jwt: d.jwt };
    })
    .catch(() => null);
}

/**
 * Returns the CF Access identity for the current session.
 * Returns null when not behind CF Access (local dev).
 * Promise is memoized for the page lifetime — safe to call concurrently.
 */
export function getCFAccessIdentity(): Promise<CFAccessIdentityResponse | null> {
  identityPromise ??= fetchIdentity();
  return identityPromise;
}

/** Returns the CF Access JWT assertion, or null when not behind CF Access. */
export async function getCFAccessJWT(): Promise<string | null> {
  const identity = await getCFAccessIdentity();
  return identity?.jwt ?? null;
}

/** True when the app is running behind CF Access (identity endpoint responds). */
export async function isBehindCFAccess(): Promise<boolean> {
  return (await getCFAccessIdentity()) !== null;
}
