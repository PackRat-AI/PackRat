/**
 * Branded login page for the PackRat MCP OAuth flow.
 *
 * Extracted from `auth.ts` (U11) so the HTML body has room to breathe — and
 * so the tests can import a single function without dragging in KV / fetch
 * stubs. The page is the *only* user-visible surface in the OAuth flow
 * (everything else is JSON), so reviewer perception of the connector hinges
 * on it. Keep it presentable, accessible, and honest about what's
 * happening: an MCP client is asking for access to a PackRat account.
 *
 * U11 SCOPE — what shipped:
 *   - PackRat branding (inline SVG mark, product-blue accent, neutral palette
 *     to match the landing site's `--primary: 0 0% 9%` token).
 *   - OAuth client-name disclosure ("Claude is requesting access...") when
 *     the caller's `clientName` is known; generic copy otherwise.
 *   - Password-reset link to `mailto:hello@packratai.com` — the Better Auth
 *     password-reset endpoint (`POST /api/auth/request-password-reset`) is
 *     POST-only and there's no public web page for it yet, so the support
 *     mailbox is the most honest path. A future web reset page can replace
 *     this href without touching the rest of the renderer.
 *   - Legal footer links to Terms, Privacy, Support on `packratai.com`.
 *     These URLs are owned by U12; the link targets are correct even if
 *     U12 has not shipped at U11 merge time.
 *   - Accessibility basics: a `<main>` landmark, a skip link, labelled
 *     form controls, `role="alert"` on the error banner, and adequate
 *     contrast on the call-to-action.
 *
 * U11 SCOPE — what did NOT ship (deferred):
 *   - Google / Apple SSO buttons. See `docs/mcp/runbook.md` § "U11: SSO
 *     deferral" for the cookie-domain blocker (`packratai.com` vs
 *     `packrat.world` share no parent — `crossSubDomainCookies` can't
 *     bridge them; Better Auth's `set-auth-token` response header is
 *     consumed by JS clients, not by browsers following an OAuth redirect).
 *     A follow-up PR will need to either (a) move the API to a subdomain
 *     of `packratai.com`, (b) extend Better Auth to encode the bearer
 *     token in the `callbackURL` query string for the social flow, or
 *     (c) introduce a one-time auth-code exchange between MCP and the
 *     API.
 *
 * STYLE NOTES:
 *   - Inline `<style>` block (no external CSS): keeps the worker bundle
 *     self-contained and means there is exactly one HTTP round trip to
 *     render the page. Total CSS is under ~2 KiB.
 *   - Form layout deliberately matches the previous (unbranded) page so
 *     U6's CSRF/Origin tests don't need to learn a new structure.
 */

import { isString } from '@packrat/guards';
import { createRegExp, exactly, global as globalFlag } from 'magic-regexp';

// ── HTML escaping ─────────────────────────────────────────────────────────────
//
// magic-regexp variants so the pre-push hook is satisfied; mirror the helpers
// in `auth.ts` rather than importing them to keep this module independent of
// the OAuth handler internals.
const AMP_RE = createRegExp(exactly('&'), [globalFlag]);
const LT_RE = createRegExp(exactly('<'), [globalFlag]);
const GT_RE = createRegExp(exactly('>'), [globalFlag]);
const QUOT_RE = createRegExp(exactly('"'), [globalFlag]);

function escapeHtml(s: string): string {
  return s
    .replace(AMP_RE, '&amp;')
    .replace(LT_RE, '&lt;')
    .replace(GT_RE, '&gt;')
    .replace(QUOT_RE, '&quot;');
}

// ── Public URLs (single source of truth for the rendered footer) ─────────────
//
// Keep these in lockstep with the URLs `/health` reports (see `auth.ts`
// and U12). The constants are not exported because the page composition
// is the only caller; if a second caller appears, lift them to a shared
// module so all surfaces drift together.
const TERMS_URL = 'https://packratai.com/terms-of-service';
const PRIVACY_URL = 'https://packratai.com/privacy-policy';
const SUPPORT_MAILTO = 'mailto:hello@packratai.com';
const PASSWORD_RESET_HREF = 'mailto:hello@packratai.com?subject=PackRat%20password%20reset';

// ── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Options passed to `renderLoginPage`. Required fields surface here as
 * non-optional; everything else is presentation polish that degrades
 * gracefully when omitted.
 */
export interface RenderLoginPageOpts {
  /**
   * OAuth state key (links the page back to KV-stored state). Echoed
   * into a hidden `state` field; the POST handler reads it to look up
   * the persisted OAuth request and CSRF nonce.
   */
  state: string;
  /**
   * CSRF nonce (must round-trip through the form's hidden `csrf` field).
   * Verified against the `__Host-PR_CSRF` cookie AND the KV-bound
   * `csrf:<state>` entry in the POST handler (see auth.ts § CSRF).
   */
  csrf: string;
  /**
   * Optional error message rendered in the page's banner. The text is
   * HTML-escaped before insertion. Caller is responsible for choosing
   * user-facing copy (see `betterAuthErrorCopy()` in auth.ts).
   */
  error?: string;
  /**
   * Optional OAuth client name (e.g. "Claude"). When present, the
   * page renders "{clientName} is requesting access to your PackRat
   * account."; when omitted, fall back to a generic line.
   */
  clientName?: string;
  /**
   * SSO buttons toggle. Reserved for the follow-up PR that ships
   * Google + Apple SSO; today this is always `false` and the option
   * is parsed-and-ignored so the function signature is stable across
   * the deferral boundary.
   */
  ssoEnabled?: boolean;
}

/**
 * Render the PackRat MCP sign-in page.
 *
 * Returns a complete HTML document body (no headers — caller wraps with
 * `Content-Type: text/html; charset=utf-8`).
 */
export function renderLoginPage(opts: RenderLoginPageOpts): string {
  const { state, csrf, error, clientName } = opts;

  // Client-name disclosure copy. The escaping is load-bearing because
  // `clientName` originates in Dynamic Client Registration metadata,
  // which is attacker-controllable for non-pre-registered clients.
  const disclosure =
    isString(clientName) && clientName.length > 0
      ? `${escapeHtml(clientName)} is requesting access to your PackRat account.`
      : 'An MCP client is requesting access to your PackRat account.';

  // Logo: inline SVG mark so the page renders in one round trip even
  // before U13 ships the public asset at `/static/logo.svg`. The mark
  // is a stylized backpack silhouette in the product-blue. Replacing
  // it with the U13 file later is a one-line swap.
  const logoSvg = `
    <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
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
  <title>Sign in · PackRat</title>
  <style>
    :root {
      --brand: #2563eb;
      --brand-hover: #1d4ed8;
      --ink: #0f172a;
      --ink-muted: #475569;
      --line: #e2e8f0;
      --bg: #ffffff;
      --bg-soft: #f8fafc;
      --error-bg: #fef2f2;
      --error-ink: #b91c1c;
      --error-line: #fecaca;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #f8fafc;
        --ink-muted: #94a3b8;
        --line: #1e293b;
        --bg: #0f172a;
        --bg-soft: #0b1220;
        --error-bg: #2a1212;
        --error-ink: #fca5a5;
        --error-line: #7f1d1d;
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
            box-shadow: 0 10px 30px rgba(15, 23, 42, .06); padding: 32px;
            width: 100%; max-width: 420px; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .brand-name { font-size: 1.1rem; font-weight: 600; letter-spacing: -.01em; }
    h1 { margin: 0 0 6px; font-size: 1.4rem; font-weight: 600; letter-spacing: -.01em; }
    p.sub { margin: 0 0 24px; color: var(--ink-muted); font-size: .92rem; line-height: 1.45; }
    label { display: block; margin-bottom: 14px; font-size: .85rem; font-weight: 500; color: var(--ink); }
    input { display: block; width: 100%; margin-top: 6px; padding: 10px 12px;
            background: var(--bg); color: var(--ink);
            border: 1px solid var(--line); border-radius: 8px; font-size: 1rem;
            transition: border-color .15s ease, box-shadow .15s ease; }
    input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
    button.submit { width: 100%; padding: 11px; background: var(--brand); color: white; border: 0;
                    border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;
                    transition: background .15s ease; margin-top: 4px; }
    button.submit:hover { background: var(--brand-hover); }
    button.submit:focus-visible { outline: 3px solid rgba(37, 99, 235, .35); outline-offset: 2px; }
    .helper { margin-top: 16px; text-align: center; font-size: .85rem; }
    .helper a { color: var(--brand); text-decoration: none; }
    .helper a:hover { text-decoration: underline; }
    .error[role="alert"] { color: var(--error-ink); background: var(--error-bg);
                           border: 1px solid var(--error-line); border-radius: 8px;
                           padding: 10px 14px; margin-bottom: 20px; font-size: .9rem; }
    footer { padding: 24px 16px; text-align: center; color: var(--ink-muted); font-size: .8rem; }
    footer a { color: var(--ink-muted); text-decoration: none; }
    footer a:hover { color: var(--ink); text-decoration: underline; }
    footer .sep { margin: 0 8px; opacity: .5; }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to sign-in form</a>
  <main id="main-content">
    <div class="card">
      <div class="brand">
        ${logoSvg}
        <span class="brand-name">PackRat</span>
      </div>
      <h1>Sign in</h1>
      <p class="sub">${disclosure}</p>
      ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ''}
      <form method="POST" action="/login" novalidate>
        <input type="hidden" name="state" value="${escapeHtml(state)}" />
        <input type="hidden" name="csrf" value="${escapeHtml(csrf)}" />
        <label>
          Email
          <input type="email" name="email" required autocomplete="email" autofocus />
        </label>
        <label>
          Password
          <input type="password" name="password" required autocomplete="current-password" />
        </label>
        <button type="submit" class="submit">Sign in</button>
      </form>
      <p class="helper">
        <a href="${PASSWORD_RESET_HREF}">Forgot your password?</a>
      </p>
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
