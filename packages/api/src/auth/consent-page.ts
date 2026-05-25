/**
 * OAuth consent page for `@better-auth/oauth-provider`.
 *
 * Mounted at `/oauth/consent` (the URL declared in the plugin's `consentPage`
 * option in `src/auth/index.ts`). The OAuth provider plugin redirects the
 * end-user here after the `/oauth2/authorize` request when consent is required.
 *
 * Two responsibilities:
 *
 *   1. RENDER  GET /oauth/consent?<signed-oauth-query>
 *      - Server-side: load the current Better Auth session via
 *        `auth.api.getSession({ headers })`. If absent → 401.
 *      - Parse the OAuth client_id, scopes, and full signed query from the URL.
 *      - Load the `oauthClient` row for client_id (name, logo, tos, policy).
 *      - If the authenticated user is NOT admin, strip `mcp:admin` from the
 *        scope list rendered in the form — see spike findings §Q2:
 *        `/oauth2/consent` accepts a REDUCED scope subset, and the issued JWT
 *        will only carry the POSTed scopes. This is the FIRST-CLASS scope-
 *        reduction mechanism the plan uses for admin gating.
 *      - Render branded HTML form mirroring packages/mcp/src/login-page.ts.
 *      - The form POSTs to /api/auth/oauth2/consent with `accept`, `scope`,
 *        and `oauth_query` fields. Better Auth's sessionMiddleware on that
 *        endpoint covers CSRF via the session cookie — no separate token.
 *
 *   2. The POST handler for `/oauth2/consent` is provided by Better Auth
 *      itself; we don't re-implement it.
 *
 * Spike refs (load-bearing):
 *   - docs/mcp/better-auth-oauth-provider-spike-2026-05-25.md §Q1-Q2
 *     (`customAccessTokenClaims` CANNOT reduce scope; `consentPage` POSTing
 *      a filtered `scope` field IS the native mechanism).
 *   - dist/index.mjs:2052 — `/oauth2/consent` body schema accepts
 *     `{ accept: boolean, scope?: string, oauth_query?: string }`.
 *   - dist/index.mjs:4007 — plugin redirects to `${consentPage}?${signedQuery}`.
 */

import { isString } from '@packrat/guards';
import { createRegExp, exactly, global as globalFlag, oneOrMore, whitespace } from 'magic-regexp';
import type { Auth } from './index';

// ── HTML escaping (magic-regexp to satisfy the no-raw-regex lint) ───────────
const AMP_RE = createRegExp(exactly('&'), [globalFlag]);
const LT_RE = createRegExp(exactly('<'), [globalFlag]);
const GT_RE = createRegExp(exactly('>'), [globalFlag]);
const QUOT_RE = createRegExp(exactly('"'), [globalFlag]);

// ── Scope-list parsing — matches RFC 6749 §3.3 (space-separated scopes) ─────
const SCOPE_SEPARATOR_RE = createRegExp(oneOrMore(whitespace));

function escapeHtml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(QUOT_RE, '&quot;');
}

// ── Scope catalog with one-line, user-facing descriptions ──────────────────
//
// These descriptions surface on the consent screen. Keep short — users read
// these mid-OAuth-flow and have low patience. The four MCP scopes mirror the
// catalog declared in src/auth/index.ts (MCP_OAUTH_SCOPES) and in
// packages/mcp/src/scopes.ts (the tool-visibility filter).
const SCOPE_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  openid: {
    title: 'Sign-in identity',
    description: 'Confirm your PackRat account identity to the application.',
  },
  profile: {
    title: 'Profile details',
    description: 'Read your name and avatar.',
  },
  email: {
    title: 'Email address',
    description: 'Read your account email address.',
  },
  offline_access: {
    title: 'Keep working in the background',
    description: 'Refresh the connection without making you sign in again.',
  },
  mcp: {
    title: 'PackRat connector access',
    description: 'Use PackRat tools through this AI assistant (read-only by default).',
  },
  'mcp:read': {
    title: 'Read your PackRat data',
    description: 'Read your packs, trips, gear, trail conditions, and pack templates.',
  },
  'mcp:write': {
    title: 'Modify your PackRat data',
    description: 'Create, update, and delete your packs, trips, items, and reports.',
  },
  'mcp:admin': {
    title: 'Admin operations',
    description:
      'Run admin-only tools (catalog jobs, reconciliation, system-wide actions). Only granted to PackRat administrators.',
  },
};

// ── Public URLs for the legal footer (mirrors packages/mcp/src/login-page.ts) ─
const TERMS_URL = 'https://packratai.com/terms-of-service';
const PRIVACY_URL = 'https://packratai.com/privacy-policy';
const SUPPORT_MAILTO = 'mailto:hello@packratai.com';

// ── Public type ─────────────────────────────────────────────────────────────

export interface OAuthClientRecord {
  clientId: string;
  /** Display name (oauthClient.name). */
  name?: string | null;
  /** Logo URL (oauthClient.icon — RFC 7591 `logo_uri`). */
  icon?: string | null;
  /** Terms of service URL (oauthClient.tos — RFC 7591 `tos_uri`). */
  tos?: string | null;
  /** Privacy policy URL (oauthClient.policy — RFC 7591 `policy_uri`). */
  policy?: string | null;
  /** Linkable client URL (oauthClient.uri — RFC 7591 `client_uri`). */
  uri?: string | null;
}

export interface ConsentPageData {
  /** Authenticated user's name/email for header copy. */
  user: { name?: string | null; email: string };
  /** Whether the authenticated user has role === 'ADMIN'. */
  isAdmin: boolean;
  /** The OAuth client requesting access. */
  client: OAuthClientRecord;
  /** Scopes the client requested (parsed from the URL `scope` param). */
  requestedScopes: string[];
  /** Scopes that will be shown / approvable (mcp:admin stripped if !isAdmin). */
  approvableScopes: string[];
  /** Full original query string the plugin signed. POSTed back verbatim. */
  oauthQuery: string;
}

// ── Renderer ────────────────────────────────────────────────────────────────

export function renderConsentPage(data: ConsentPageData): string {
  const { user, client, approvableScopes, oauthQuery } = data;

  const clientName =
    isString(client.name) && client.name.length > 0 ? client.name : 'An MCP client';

  const logoMarkup =
    isString(client.icon) && client.icon.length > 0
      ? `<img src="${escapeHtml(client.icon)}" alt="" class="client-logo" width="56" height="56" />`
      : `<div class="client-logo client-logo-fallback" aria-hidden="true">${escapeHtml(clientName.charAt(0).toUpperCase())}</div>`;

  // Per-scope rows. The form submits a single space-joined `scope` string;
  // each visible row has a checked checkbox the user can untick to opt out.
  const scopeRows = approvableScopes
    .map((s) => {
      const meta = SCOPE_DESCRIPTIONS[s] ?? {
        title: s,
        description: 'No description available.',
      };
      return `
        <label class="scope">
          <input type="checkbox" name="scope" value="${escapeHtml(s)}" checked />
          <span class="scope-body">
            <strong>${escapeHtml(meta.title)}</strong>
            <span class="scope-id">${escapeHtml(s)}</span>
            <span class="scope-desc">${escapeHtml(meta.description)}</span>
          </span>
        </label>`;
    })
    .join('');

  // Client metadata links: privacy + tos + (optional) homepage.
  const clientLinks: string[] = [];
  if (isString(client.policy) && client.policy.length > 0) {
    clientLinks.push(
      `<a href="${escapeHtml(client.policy)}" target="_blank" rel="noopener noreferrer">Client privacy</a>`,
    );
  }
  if (isString(client.tos) && client.tos.length > 0) {
    clientLinks.push(
      `<a href="${escapeHtml(client.tos)}" target="_blank" rel="noopener noreferrer">Client terms</a>`,
    );
  }
  if (isString(client.uri) && client.uri.length > 0) {
    clientLinks.push(
      `<a href="${escapeHtml(client.uri)}" target="_blank" rel="noopener noreferrer">About ${escapeHtml(clientName)}</a>`,
    );
  }
  const clientLinksMarkup =
    clientLinks.length > 0
      ? `<p class="client-links">${clientLinks.join(' <span class="sep" aria-hidden="true">·</span> ')}</p>`
      : '';

  const userIdent =
    isString(user.name) && user.name.length > 0
      ? `${escapeHtml(user.name)} (${escapeHtml(user.email)})`
      : escapeHtml(user.email);

  // PackRat logo SVG — mirrors packages/mcp/src/login-page.ts style.
  const packratLogo = `
    <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <title>PackRat</title>
      <rect x="14" y="18" width="36" height="38" rx="8" fill="#2563eb"/>
      <rect x="22" y="10" width="20" height="14" rx="4" fill="#1d4ed8"/>
      <rect x="22" y="32" width="20" height="8" rx="2" fill="#bfdbfe"/>
      <circle cx="32" cy="46" r="3" fill="#bfdbfe"/>
    </svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Authorize ${escapeHtml(clientName)} · PackRat</title>
  <style>
    :root {
      --brand: #2563eb;
      --brand-hover: #1d4ed8;
      --ink: #0f172a;
      --ink-muted: #475569;
      --line: #e2e8f0;
      --bg: #ffffff;
      --bg-soft: #f8fafc;
      --bg-row: #f1f5f9;
      --danger: #b91c1c;
      --danger-bg: #fef2f2;
      --danger-line: #fecaca;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #f8fafc;
        --ink-muted: #94a3b8;
        --line: #1e293b;
        --bg: #0f172a;
        --bg-soft: #0b1220;
        --bg-row: #111c34;
        --danger: #fca5a5;
        --danger-bg: #2a1212;
        --danger-line: #7f1d1d;
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg-soft); color: var(--ink); }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
           min-height: 100vh; display: flex; flex-direction: column; }
    .skip-link { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }
    .skip-link:focus { left: 16px; top: 16px; width: auto; height: auto; padding: 8px 12px;
                       background: var(--brand); color: white; border-radius: 6px; z-index: 100; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 16px; }
    .card { background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, .06); padding: 28px;
            width: 100%; max-width: 560px; }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .brand-name { font-size: 1rem; font-weight: 600; letter-spacing: -.01em; }
    .header { display: flex; align-items: center; gap: 14px; padding-bottom: 18px;
              border-bottom: 1px solid var(--line); margin-bottom: 18px; }
    .client-logo { border-radius: 10px; flex-shrink: 0; background: var(--bg-soft);
                   border: 1px solid var(--line); object-fit: cover; }
    .client-logo-fallback { width: 56px; height: 56px; display: inline-flex;
                            align-items: center; justify-content: center;
                            font-weight: 700; font-size: 1.4rem; color: var(--brand); }
    .header h1 { margin: 0 0 4px; font-size: 1.2rem; font-weight: 600; letter-spacing: -.01em; }
    .header p { margin: 0; color: var(--ink-muted); font-size: .9rem; line-height: 1.4; }
    .as-user { font-size: .85rem; color: var(--ink-muted); margin: 0 0 14px; }
    .as-user strong { color: var(--ink); font-weight: 500; }
    .perm-heading { margin: 18px 0 10px; font-size: .85rem; font-weight: 600; color: var(--ink); letter-spacing: .02em; text-transform: uppercase; }
    .scope { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px;
             background: var(--bg-row); border: 1px solid var(--line); border-radius: 8px;
             margin-bottom: 8px; cursor: pointer; }
    .scope input { margin-top: 3px; accent-color: var(--brand); }
    .scope-body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
    .scope-body strong { font-size: .95rem; font-weight: 600; }
    .scope-id { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: .75rem; color: var(--ink-muted); }
    .scope-desc { font-size: .85rem; color: var(--ink-muted); line-height: 1.45; }
    .actions { display: flex; gap: 10px; margin-top: 22px; }
    button { flex: 1; padding: 11px 16px; border-radius: 8px; font-size: .95rem;
             font-weight: 600; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
    button.approve { background: var(--brand); color: white; border: 1px solid var(--brand); }
    button.approve:hover { background: var(--brand-hover); border-color: var(--brand-hover); }
    button.approve:focus-visible { outline: 3px solid rgba(37, 99, 235, .35); outline-offset: 2px; }
    button.deny { background: var(--bg); color: var(--ink); border: 1px solid var(--line); }
    button.deny:hover { background: var(--bg-soft); }
    .client-links { margin: 14px 0 0; font-size: .8rem; color: var(--ink-muted); text-align: center; }
    .client-links a { color: var(--ink-muted); text-decoration: underline; }
    .client-links a:hover { color: var(--ink); }
    .client-links .sep { opacity: .5; }
    footer { padding: 24px 16px; text-align: center; color: var(--ink-muted); font-size: .8rem; }
    footer a { color: var(--ink-muted); text-decoration: none; }
    footer a:hover { color: var(--ink); text-decoration: underline; }
    footer .sep { margin: 0 8px; opacity: .5; }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to consent form</a>
  <main id="main-content">
    <div class="card">
      <div class="brand">
        ${packratLogo}
        <span class="brand-name">PackRat</span>
      </div>
      <div class="header">
        ${logoMarkup}
        <div>
          <h1>${escapeHtml(clientName)} wants to access your PackRat account</h1>
          <p>Review the permissions below before approving.</p>
        </div>
      </div>
      <p class="as-user">Signed in as <strong>${userIdent}</strong></p>

      <form method="POST" action="/api/auth/oauth2/consent" novalidate>
        <input type="hidden" name="oauth_query" value="${escapeHtml(oauthQuery)}" />

        <div class="perm-heading">Permissions ${escapeHtml(clientName)} will receive</div>
        ${scopeRows}

        <div class="actions">
          <button type="submit" name="accept" value="false" class="deny">Deny</button>
          <button type="submit" name="accept" value="true" class="approve">Authorize ${escapeHtml(clientName)}</button>
        </div>
        ${clientLinksMarkup}
      </form>
    </div>
  </main>
  <footer>
    <a href="${TERMS_URL}">Terms</a>
    <span class="sep" aria-hidden="true">·</span>
    <a href="${PRIVACY_URL}">Privacy</a>
    <span class="sep" aria-hidden="true">·</span>
    <a href="${SUPPORT_MAILTO}">Support</a>
  </footer>
</body>
</html>`;
}

// ── Page handler (called by the API worker dispatcher) ──────────────────────

/**
 * Handle GET /oauth/consent. Returns:
 *   - 302 to /api/auth/sign-in?... if the user isn't signed in (so the user
 *     authenticates and is redirected back by the Better Auth login flow)
 *   - 400 if the URL is missing the required signed query (client_id, scope)
 *   - 404 if the client_id doesn't correspond to a registered oauthClient row
 *   - 200 text/html with the rendered consent form otherwise
 */
export interface HandleConsentPageDeps {
  auth: Auth;
  /** drizzle-neon-http instance — full type would require workspace coupling that index.ts already avoids */
  // biome-ignore lint/suspicious/noExplicitAny: see field comment
  db: any;
  /** @packrat/db schema namespace — same coupling reason as `db` */
  // biome-ignore lint/suspicious/noExplicitAny: see field comment
  schema: any;
}

export async function handleConsentPage(
  request: Request,
  deps: HandleConsentPageDeps,
): Promise<Response> {
  const { auth, db, schema } = deps;
  const url = new URL(request.url);
  const params = url.searchParams;

  const clientId = params.get('client_id');
  const requestedScopeStr = params.get('scope') ?? '';

  if (!clientId) {
    return new Response('Missing client_id parameter', { status: 400 });
  }

  // Resolve the current Better Auth session from cookies/bearer. The plugin
  // would normally redirect to loginPage when no session, but the page route
  // is hit directly — we re-check here to fail closed.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    // Redirect to sign-in with a callbackURL so the user returns here after.
    const signInUrl = new URL('/api/auth/sign-in', url.origin);
    signInUrl.searchParams.set('callbackURL', url.toString());
    return Response.redirect(signInUrl.toString(), 302);
  }

  // Load the OAuth client record so we can render its branding.
  const { eq } = await import('drizzle-orm');
  const clientRows = await db
    .select()
    .from(schema.oauthClient)
    .where(eq(schema.oauthClient.clientId, clientId))
    .limit(1);
  const client = clientRows[0] as
    | {
        clientId: string;
        name: string | null;
        icon: string | null;
        tos: string | null;
        policy: string | null;
        uri: string | null;
      }
    | undefined;

  if (!client) {
    return new Response(`Unknown OAuth client: ${escapeHtml(clientId)}`, { status: 404 });
  }

  const requestedScopes = requestedScopeStr.split(SCOPE_SEPARATOR_RE).filter(Boolean);

  // Admin-scope filter: non-admin users can NOT approve mcp:admin even if
  // the client requested it. Spike-verified: POSTing a reduced `scope` to
  // /oauth2/consent results in a JWT carrying ONLY the reduced set.
  const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
  const approvableScopes = requestedScopes.filter((s) => isAdmin || s !== 'mcp:admin');

  const html = renderConsentPage({
    user: { name: session.user.name, email: session.user.email },
    isAdmin,
    client: {
      clientId: client.clientId,
      name: client.name,
      icon: client.icon,
      tos: client.tos,
      policy: client.policy,
      uri: client.uri,
    },
    requestedScopes,
    approvableScopes,
    oauthQuery: url.search.startsWith('?') ? url.search.slice(1) : url.search,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}
