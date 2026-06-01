/**
 * Pure JSX renderer for the OAuth consent page.
 *
 * The routing / session-resolution / DB-lookup glue lives in
 * `consent-route.tsx` (mounted on the top-level Elysia `app` via
 * `.use(consentRoute)`). This file owns only `renderConsentPage(data)` and
 * its supporting types — given a fully-resolved `ConsentPageData`, it
 * returns the complete HTML5 document as a string.
 *
 * Rendering details:
 *   - JSX via @kitajs/html's string-rendering runtime (no React, no virtual
 *     DOM). The `safe` attribute on each user-content element triggers
 *     HTML-spec escape via @kitajs/html; `@kitajs/ts-html-plugin` enforces
 *     this at compile time (error K601) and via the `xss-scan` CI command.
 *   - The form POSTs to `/api/auth/oauth2/consent` with `accept`, `scope`,
 *     and `oauth_query` fields. Better Auth's sessionMiddleware on that
 *     endpoint covers CSRF via the session cookie — no separate token.
 *     IMPORTANT: that endpoint reads `scope` as a SINGLE space-joined string
 *     (`ctx.body.scope?.split(" ")`, body schema `scope: z.string().optional()`),
 *     NOT one field per scope. So the per-scope checkboxes are `name="scope_option"`
 *     (UX only) and a single hidden `<input name="scope">` carries the
 *     space-joined selection — written by an inline submit handler when JS is
 *     on, or its server-rendered default (the full approvable set) when JS is
 *     off. Submitting multiple `scope` fields would silently grant only one.
 *   - Non-admins have `mcp:admin` filtered out before render (see
 *     `consent-route.tsx`). This is the FIRST-CLASS scope-reduction
 *     mechanism the plugin supports — `customAccessTokenClaims` CANNOT
 *     reduce scope; only POSTing a reduced `scope` field to /oauth2/consent
 *     can. The issued JWT carries ONLY the POSTed scopes.
 *
 * Spike refs (load-bearing):
 *   - docs/mcp/better-auth-oauth-provider-spike-2026-05-25.md §Q1-Q2
 *   - dist/index.mjs:2052 — `/oauth2/consent` body schema accepts
 *     `{ accept: boolean, scope?: string, oauth_query?: string }`.
 *   - dist/index.mjs:4007 — plugin redirects to `${consentPage}?${signedQuery}`.
 */

import { Html } from '@kitajs/html';
import { isString } from '@packrat/guards';

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

// ── Public types ────────────────────────────────────────────────────────────

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

// ── Inline CSS (kept as a string — `<style>` content is not HTML-escaped) ───
//
// @kitajs/html treats `<style>` and `<script>` children as raw by spec, so
// passing a string here renders the CSS verbatim. Defining the stylesheet
// once at module scope keeps the JSX tree below readable.
const CONSENT_PAGE_STYLES = `
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
`;

// ── Inline submit handler (kept as a string — `<script>` content is raw) ────
//
// Better Auth's /oauth2/consent endpoint expects ONE space-joined `scope`
// string, not one form field per scope. On submit, this reads the checked
// `scope_option` checkboxes and writes their space-joined values into the
// single hidden `<input name="scope">`, so the user can de-select individual
// scopes (partial approval). With JS disabled this never runs and the hidden
// input keeps its server-rendered default (the full approvable set).
//
// No CSP is set on this route (consent-route.tsx sets only cache-control,
// x-content-type-options, x-frame-options), so no nonce is required. If a
// `script-src` CSP is ever added, this inline script will need a matching
// nonce. @kitajs/html renders `<script>` children raw (no escaping), so the
// string is emitted verbatim.
const CONSENT_FORM_SCRIPT = `
(function () {
  var form = document.getElementById('consent-form');
  if (!form) return;
  var scopeInput = document.getElementById('consent-scope');
  if (!scopeInput) return;
  form.addEventListener('submit', function () {
    var boxes = form.querySelectorAll('input[name="scope_option"]:checked');
    var scopes = [];
    for (var i = 0; i < boxes.length; i++) scopes.push(boxes[i].value);
    scopeInput.value = scopes.join(' ');
  });
})();
`;

// ── JSX components ──────────────────────────────────────────────────────────

function PackratLogo(): JSX.Element {
  return (
    <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <title>PackRat</title>
      <rect x="14" y="18" width="36" height="38" rx="8" fill="#2563eb" />
      <rect x="22" y="10" width="20" height="14" rx="4" fill="#1d4ed8" />
      <rect x="22" y="32" width="20" height="8" rx="2" fill="#bfdbfe" />
      <circle cx="32" cy="46" r="3" fill="#bfdbfe" />
    </svg>
  );
}

function ClientLogo({ client, name }: { client: OAuthClientRecord; name: string }): JSX.Element {
  if (isString(client.icon) && client.icon.length > 0) {
    // Attribute auto-escape covers client.icon; only XSS risk would be a
    // crafted `data:`/`javascript:` URL, which kitajs's attribute escape
    // does not validate. Client URLs come from the seed/admin path and are
    // operator-controlled, so this is acceptable.
    return <img src={client.icon} alt="" class="client-logo" width="56" height="56" />;
  }
  return (
    <div class="client-logo client-logo-fallback" aria-hidden="true" safe>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ScopeRow({ scope }: { scope: string }): JSX.Element {
  const meta = SCOPE_DESCRIPTIONS[scope] ?? {
    title: scope,
    description: 'No description available.',
  };
  // NOTE: the checkbox is deliberately NOT `name="scope"`. Better Auth's
  // /oauth2/consent endpoint reads a SINGLE space-joined `scope` string
  // (`ctx.body.scope?.split(" ")`); multiple form fields named `scope` would
  // collapse to one value and silently grant only one scope. Instead these
  // checkboxes drive UX only (name="scope_option") and an inline submit
  // handler writes the space-joined selection into the hidden `scope` input
  // below. With JS disabled, that hidden input's default (the full approvable
  // set) is submitted — see CONSENT_FORM_SCRIPT and the hidden input in
  // ConsentPage.
  return (
    <label class="scope">
      <input type="checkbox" name="scope_option" value={scope} checked />
      <span class="scope-body">
        <strong safe>{meta.title}</strong>
        <span class="scope-id" safe>
          {scope}
        </span>
        <span class="scope-desc" safe>
          {meta.description}
        </span>
      </span>
    </label>
  );
}

function ClientLinks({
  client,
  clientName,
}: {
  client: OAuthClientRecord;
  clientName: string;
}): JSX.Element | null {
  const links: JSX.Element[] = [];
  if (isString(client.policy) && client.policy.length > 0) {
    links.push(
      <a href={client.policy} target="_blank" rel="noopener noreferrer">
        Client privacy
      </a>,
    );
  }
  if (isString(client.tos) && client.tos.length > 0) {
    links.push(
      <a href={client.tos} target="_blank" rel="noopener noreferrer">
        Client terms
      </a>,
    );
  }
  if (isString(client.uri) && client.uri.length > 0) {
    links.push(
      <a href={client.uri} target="_blank" rel="noopener noreferrer" safe>
        {`About ${clientName}`}
      </a>,
    );
  }
  if (links.length === 0) return null;
  // Interleave a `·` separator between links — only between, not at the ends.
  const withSeparators = links.flatMap((link, i) =>
    i === 0
      ? [link]
      : [
          <span class="sep" aria-hidden="true">
            ·
          </span>,
          link,
        ],
  );
  // `withSeparators` is an array of JSX elements whose user-input parts were
  // individually escaped via `safe` (links above). The ts-html-plugin can't
  // prove that statically across an array boundary, so we mark the value as
  // already-safe per the documented escape hatch:
  // https://html.kitajs.org/packages/ts-html-plugin#k601
  return <p class="client-links">{withSeparators as 'safe'}</p>;
}

function SignedInIdent({ user }: { user: ConsentPageData['user'] }): JSX.Element {
  // Both user.name and user.email come straight from Better Auth; treat them
  // as untrusted user-supplied input and escape via `safe`.
  if (isString(user.name) && user.name.length > 0) {
    return (
      <span safe>
        {user.name} ({user.email})
      </span>
    );
  }
  return <span safe>{user.email}</span>;
}

function ConsentPage(data: ConsentPageData): JSX.Element {
  const { user, client, approvableScopes, oauthQuery } = data;
  const clientName =
    isString(client.name) && client.name.length > 0 ? client.name : 'An MCP client';

  // oauthQuery is interpolated into a `value="..."` attribute. kitajs escapes
  // attribute values for quote-break-out but does NOT entity-encode `&`,
  // which produces strict-spec-invalid markup. Explicit escape gives the
  // HTML5-strict output the old code shipped.
  const escapedOauthQuery = Html.escapeHtml(oauthQuery);

  // Default value for the single hidden `scope` field: the full approvable
  // set, space-joined per RFC 6749 §3.3. This is the NO-JS fallback — if the
  // submit handler doesn't run, this exact set is granted (matching what the
  // user sees pre-checked). The scope strings are catalog-defined (no spaces),
  // so the join is unambiguous. Escaped for the `value="..."` attribute.
  const defaultScopeValue = Html.escapeHtml(approvableScopes.join(' '));

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title safe>{`Authorize ${clientName} · PackRat`}</title>
        <style>{CONSENT_PAGE_STYLES}</style>
      </head>
      <body>
        <a href="#main-content" class="skip-link">
          Skip to consent form
        </a>
        <main id="main-content">
          <div class="card">
            <div class="brand">
              <PackratLogo />
              <span class="brand-name">PackRat</span>
            </div>
            <div class="header">
              <ClientLogo client={client} name={clientName} />
              <div>
                <h1 safe>{`${clientName} wants to access your PackRat account`}</h1>
                <p>Review the permissions below before approving.</p>
              </div>
            </div>
            <p class="as-user">
              Signed in as <SignedInIdent user={user} />
            </p>

            <form id="consent-form" method="POST" action="/api/auth/oauth2/consent" novalidate>
              <input type="hidden" name="oauth_query" value={escapedOauthQuery} />
              {/* Single space-joined `scope` field the endpoint actually reads.
                  Defaults to the full approvable set (no-JS fallback); the
                  inline submit handler overwrites it with the checked subset. */}
              <input type="hidden" id="consent-scope" name="scope" value={defaultScopeValue} />

              <div class="perm-heading" safe>
                {`Permissions ${clientName} will receive`}
              </div>
              {approvableScopes.map((s) => (
                <ScopeRow scope={s} />
              ))}

              <div class="actions">
                <button type="submit" name="accept" value="false" class="deny">
                  Deny
                </button>
                <button type="submit" name="accept" value="true" class="approve" safe>
                  {`Authorize ${clientName}`}
                </button>
              </div>
              <ClientLinks client={client} clientName={clientName} />
            </form>
            <script>{CONSENT_FORM_SCRIPT}</script>
          </div>
        </main>
        <footer>
          <a href={TERMS_URL}>Terms</a>
          <span class="sep" aria-hidden="true">
            ·
          </span>
          <a href={PRIVACY_URL}>Privacy</a>
          <span class="sep" aria-hidden="true">
            ·
          </span>
          <a href={SUPPORT_MAILTO}>Support</a>
        </footer>
      </body>
    </html>
  );
}

// ── Public renderer ─────────────────────────────────────────────────────────

/**
 * Render the consent page to a complete HTML5 document.
 *
 * @kitajs/html's classic JSX runtime (Html.createElement) compiles JSX
 * expressions to string-returning calls at runtime — `<ConsentPage />`
 * evaluates to the rendered HTML string. No virtual DOM, no hydration.
 *
 * XSS safety: every JSX element that interpolates user-supplied content
 * uses the `safe` attribute (escapes element content) or wraps the value
 * in `Html.escapeHtml()` (escapes attribute values). The
 * `@kitajs/ts-html-plugin` (tsconfig.json plugins) catches missing `safe`
 * at compile time as error K601.
 */
export function renderConsentPage(data: ConsentPageData): string {
  return `<!DOCTYPE html>${<ConsentPage {...data} />}`;
}

// The route handler that used to live here (`handleConsentPage`) moved to
// `consent-route.tsx` so the consent flow can be a proper Elysia route
// mounted via `.use(html())`. This file now owns only the pure JSX renderer.
