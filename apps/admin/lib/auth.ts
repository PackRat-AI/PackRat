/**
 * Admin authentication utilities.
 *
 * Production: Cloudflare Zero Trust (Access) protects the app at the edge.
 *   - Cloudflare injects `CF-Access-Authenticated-User-Email` on every request.
 *
 * Development: Session cookie set by the /login page.
 *   - Credentials verified against ADMIN_USERNAME / ADMIN_PASSWORD env vars.
 *
 * API calls (server → Hono API): reuse the same ADMIN_USERNAME / ADMIN_PASSWORD
 * as HTTP Basic auth — no extra env var needed.
 */

/** Authorization header sent by the admin app to the Hono API. */
export function getAdminApiAuthHeader(): string {
  const username = process.env.ADMIN_USERNAME ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

/** Token stored in the dev session cookie. */
export function makeSessionToken(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

/** Validates the dev session cookie against env credentials. */
export function verifySessionToken(token: string): boolean {
  const username = process.env.ADMIN_USERNAME ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!username || !password) return false;
  return token === makeSessionToken(username, password);
}
