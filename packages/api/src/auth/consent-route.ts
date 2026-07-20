/**
 * Elysia route for the OAuth consent page (`GET /oauth/consent`).
 *
 * Mounted on the top-level `app` in `src/index.ts`. The `@better-auth/oauth-provider`
 * plugin redirects the user-agent here mid-OAuth-flow when the user needs to
 * approve scopes for a client; the route reads the user's Better Auth
 * session, optionally filters `mcp:admin` from the rendered scope list for
 * non-admins, and renders the branded consent page.
 *
 * The HTML renderer lives in `@packrat/consent-ui` — a BUILT package whose
 * public surface is plain (`renderConsentPage(data): string`), so its
 * @kitajs/html global JSX namespace never enters the API's type program. This
 * file is plain TS (no JSX) and owns only the routing + dependency glue; it
 * sets `Content-Type: text/html` itself rather than via @elysiajs/html.
 *
 * Behaviour:
 *   - 400 if `client_id` is missing from the query
 *   - 302 to `/api/auth/sign-in?callbackURL=...` when there's no session
 *   - 404 if `client_id` doesn't match any `oauthClient` row
 *   - 200 text/html with the consent form otherwise (security headers set
 *     via `set.headers`: Cache-Control: no-store, X-Content-Type-Options,
 *     X-Frame-Options: DENY)
 */

import { getAuth } from '@packrat/api/auth';
import { createDb } from '@packrat/api/db';
import { getEnv } from '@packrat/api/utils/env-validation';
import { type OAuthClientRecord, renderConsentPage, renderSignInPage } from '@packrat/consent-ui';
import * as dbSchema from '@packrat/db';
import { isString, toRecord, toString as toStr } from '@packrat/guards';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { createRegExp, oneOrMore, whitespace } from 'magic-regexp';

// Matches RFC 6749 §3.3 (space-separated scopes).
const SCOPE_SEPARATOR_RE = createRegExp(oneOrMore(whitespace));

/**
 * GET /api/auth/sign-in — sign-in page for the OAuth consent flow.
 *
 * `@better-auth/oauth-provider` redirects here when the user isn't
 * authenticated mid-OAuth-flow (configured via `loginPage` in auth/index.ts).
 * Better Auth passes the raw OAuth params on the query string rather than a
 * `callbackURL`; the inline JS in the rendered page reconstructs the authorize
 * URL from those params after a successful sign-in.
 */
export const signInRoute = new Elysia().get('/api/auth/sign-in', ({ query, set }) => {
  // The callbackURL may or may not be present. The inline JS in the page
  // handles both cases — if absent it reconstructs from window.location.search.
  const callbackURL = isString(query.callbackURL) ? query.callbackURL : '';
  set.headers['content-type'] = 'text/html; charset=utf-8';
  set.headers['cache-control'] = 'no-store';
  set.headers['x-content-type-options'] = 'nosniff';
  set.headers['x-frame-options'] = 'DENY';
  return renderSignInPage({ callbackURL });
});

export const consentRoute = new Elysia().get('/oauth/consent', async ({ request, query, set }) => {
  const clientId = isString(query.client_id) ? query.client_id : '';
  if (!clientId) {
    set.status = 400;
    return 'Missing client_id parameter';
  }

  const env = getEnv();
  const auth = await getAuth(env);

  // Resolve the current Better Auth session from cookies/bearer. The plugin
  // would normally redirect to loginPage when no session, but the page
  // route is hit directly — re-check here to fail closed.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    const url = new URL(request.url);
    const signInUrl = new URL('/api/auth/sign-in', url.origin);
    signInUrl.searchParams.set('callbackURL', url.toString());
    set.status = 302;
    set.headers.location = signInUrl.toString();
    return null;
  }

  // Load the OAuth client row for branding (name, logo, tos, policy, uri).
  const db = createDb();
  const clientRows = await db
    .select()
    .from(dbSchema.oauthClient)
    .where(eq(dbSchema.oauthClient.clientId, clientId))
    .limit(1);
  const clientRow = clientRows[0] as (OAuthClientRecord & { clientId: string }) | undefined;

  if (!clientRow) {
    set.status = 404;
    // Plain-text response (no HTML), so the validated clientId can't be an
    // XSS vector and we avoid any @kitajs/html dependency here.
    set.headers['content-type'] = 'text/plain; charset=utf-8';
    return `Unknown OAuth client: ${clientId}`;
  }

  const requestedScopeStr = isString(query.scope) ? query.scope : '';
  const requestedScopes = requestedScopeStr.split(SCOPE_SEPARATOR_RE).filter(Boolean);

  // Admin-scope filter: non-admin users can NOT approve mcp:admin even if
  // the client requested it. Spike-verified: POSTing a reduced `scope` to
  // /oauth2/consent results in a JWT carrying ONLY the reduced set.
  //
  // `session.user.role` is added by Better Auth's admin plugin but isn't
  // surfaced on the base getSession() return type; @packrat/guards' toRecord
  // + toString narrow it without a hand-written cast.
  const userRole = toStr(toRecord(session.user).role) ?? 'USER';
  const isAdmin = userRole === 'ADMIN';
  const approvableScopes = requestedScopes.filter((s) => isAdmin || s !== 'mcp:admin');

  const url = new URL(request.url);
  const oauthQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;

  // renderConsentPage returns a complete HTML document string; set the
  // content-type ourselves (no @elysiajs/html plugin — importing it would
  // re-pull @kitajs/html's global JSX into the API's type surface). The rest
  // are OAuth-flow security defaults.
  set.headers['content-type'] = 'text/html; charset=utf-8';
  set.headers['cache-control'] = 'no-store';
  set.headers['x-content-type-options'] = 'nosniff';
  set.headers['x-frame-options'] = 'DENY';

  return renderConsentPage({
    user: { name: session.user.name, email: session.user.email },
    isAdmin,
    client: {
      clientId: clientRow.clientId,
      name: clientRow.name,
      icon: clientRow.icon,
      tos: clientRow.tos,
      policy: clientRow.policy,
      uri: clientRow.uri,
    },
    requestedScopes,
    approvableScopes,
    oauthQuery,
  });
});
