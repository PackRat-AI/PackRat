// CF Access client-side utilities for the admin SPA.
//
// CF Access protects the admin app in production. After authentication, CF sets
// an HttpOnly cookie (not readable by JS). The identity endpoint at
// /cdn-cgi/access/get-identity returns the signed JWT assertion we can forward
// to the API for cryptographic verification.

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from 'admin-app/lib/queryKeys';

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

/**
 * TanStack Query hook for the CF Access identity.
 * - staleTime: Infinity — identity is valid for the page lifetime, no re-fetch needed.
 * - gcTime: Infinity — don't garbage-collect mid-session when AuthGuard unmounts during navigation.
 * - retry: false — null means "not behind CF Access" (local dev), not a transient error.
 *
 * The underlying Promise memoization in getCFAccessIdentity() still applies — both
 * layers complement each other during the window before TanStack's cache is populated.
 */
export function useCFAccessIdentity() {
  return useQuery({
    queryKey: queryKeys.cfAccessIdentity,
    queryFn: getCFAccessIdentity,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
