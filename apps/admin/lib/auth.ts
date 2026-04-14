/**
 * Admin authentication utilities.
 *
 * Production: Cloudflare Zero Trust (Access) protects the app at the edge.
 *   - Cloudflare injects `CF-Access-Authenticated-User-Email` on every request
 *     that passes through an Access policy. No credentials needed in the app.
 *
 * Development: Session cookie set by the /login page.
 *   - Credentials verified against ADMIN_USERNAME / ADMIN_PASSWORD env vars
 *     (these are local to the admin app — the API uses ADMIN_SERVICE_TOKEN).
 *
 * API calls (server → Hono API): use ADMIN_SERVICE_TOKEN as a bearer token.
 */

/** Authorization header sent by the admin app to the Hono API. */
export function getAdminApiBearerHeader(): string {
  const token = process.env.ADMIN_SERVICE_TOKEN ?? '';
  return `Bearer ${token}`;
}

/** Token stored in the dev session cookie (base64 of username:password). */
export function makeSessionToken(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

/** Validates the dev session cookie value against env credentials. */
export function verifySessionToken(token: string): boolean {
  const username = process.env.ADMIN_USERNAME ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!username || !password) return false;
  return token === makeSessionToken(username, password);
}
