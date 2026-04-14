/**
 * Admin authentication utilities.
 *
 * Production: Cloudflare Zero Trust (Access) protects the app at the edge.
 *   - Cloudflare injects `CF-Access-Authenticated-User-Email` on every request
 *     that passes through an Access policy.
 *   - No credentials need to be stored in the app.
 *
 * Development: Session cookie set by the /login page.
 *   - Credentials verified against ADMIN_USERNAME / ADMIN_PASSWORD env vars.
 *   - Session token = base64(username:password) stored in `admin-session` cookie.
 */

export function getAdminApiAuthHeader(): string {
  const username = process.env.ADMIN_USERNAME ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export function makeSessionToken(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

export function verifySessionToken(token: string): boolean {
  const username = process.env.ADMIN_USERNAME ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!username || !password) return false;
  const expected = makeSessionToken(username, password);
  return token === expected;
}
