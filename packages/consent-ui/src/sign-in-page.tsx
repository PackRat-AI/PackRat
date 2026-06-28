/**
 * Pure JSX renderer for the OAuth sign-in page.
 *
 * Served by `consent-route.ts` at GET `/api/auth/sign-in` when
 * `@better-auth/oauth-provider` redirects an unauthenticated user there mid-flow.
 * Follows the same rendering approach as `consent-page.tsx`:
 *   - @kitajs/html string-rendering JSX (no React, no virtual DOM)
 *   - Inline styles; no external CSS
 *   - `safe` on every user-content interpolation
 *   - Inline JS for the async sign-in fetch so `<noscript>` shows a fallback
 */

// biome-ignore lint/correctness/noUnusedImports: @kitajs/html classic JSX runtime requires Html in scope for the JSX transform (Html.createElement)
import { Html } from '@kitajs/html';
import { isString } from '@packrat/guards';

const TERMS_URL = 'https://packratai.com/terms-of-service';
const PRIVACY_URL = 'https://packratai.com/privacy-policy';
const SUPPORT_MAILTO = 'mailto:hello@packratai.com';

const SIGN_IN_PAGE_STYLES = `
:root {
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
  --ink: #0f172a;
  --ink-muted: #475569;
  --line: #e2e8f0;
  --bg: #ffffff;
  --bg-soft: #f8fafc;
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
    --danger: #fca5a5;
    --danger-bg: #2a1212;
    --danger-line: #7f1d1d;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg-soft); color: var(--ink); }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
       min-height: 100vh; display: flex; flex-direction: column; }
main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 16px; }
.card { background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
        box-shadow: 0 10px 30px rgba(15,23,42,.06); padding: 28px;
        width: 100%; max-width: 420px; }
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.brand-name { font-size: 1rem; font-weight: 600; letter-spacing: -.01em; }
h1 { margin: 0 0 6px; font-size: 1.2rem; font-weight: 600; }
.subtitle { margin: 0 0 22px; color: var(--ink-muted); font-size: .9rem; }
label { display: block; font-size: .875rem; font-weight: 500; margin-bottom: 6px; }
input[type=email], input[type=password] {
  display: block; width: 100%; padding: 10px 12px; font-size: .95rem;
  border: 1px solid var(--line); border-radius: 8px; background: var(--bg);
  color: var(--ink); outline: none; margin-bottom: 14px;
  transition: border-color .15s; }
input[type=email]:focus, input[type=password]:focus { border-color: var(--brand); }
button[type=submit] {
  width: 100%; padding: 11px; background: var(--brand); color: white;
  border: 1px solid var(--brand); border-radius: 8px; font-size: .95rem;
  font-weight: 600; cursor: pointer; transition: background .15s, border-color .15s;
  margin-top: 4px; }
button[type=submit]:hover { background: var(--brand-hover); border-color: var(--brand-hover); }
button[type=submit]:disabled { opacity: .6; cursor: not-allowed; }
.error { display: none; background: var(--danger-bg); border: 1px solid var(--danger-line);
         color: var(--danger); border-radius: 8px; padding: 10px 14px;
         font-size: .875rem; margin-bottom: 14px; }
.error.visible { display: block; }
footer { padding: 24px 16px; text-align: center; color: var(--ink-muted); font-size: .8rem; }
footer a { color: var(--ink-muted); text-decoration: none; }
footer a:hover { color: var(--ink); text-decoration: underline; }
footer .sep { margin: 0 8px; opacity: .5; }
`;

// Inline script: submits credentials to Better Auth's sign-in endpoint,
// then redirects to callbackURL on success.
const SIGN_IN_SCRIPT = `
(function () {
  var form = document.getElementById('sign-in-form');
  var errorBox = document.getElementById('sign-in-error');
  var submitBtn = document.getElementById('sign-in-submit');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBox.textContent = '';
    errorBox.classList.remove('visible');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    // Better Auth passes the raw OAuth authorize params to loginPage (no callbackURL).
    // Reconstruct the authorize URL so the OAuth flow resumes after sign-in.
    var params = new URLSearchParams(window.location.search);
    var callbackURL = params.get('callbackURL')
      || ('/api/auth/oauth2/authorize' + window.location.search);
    var email = form.elements['email'].value;
    var password = form.elements['password'].value;

    try {
      var res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, callbackURL: callbackURL }),
        credentials: 'include',
      });

      var data;
      try { data = await res.clone().json(); } catch (_) { data = null; }

      if (res.ok) {
        // Better Auth may embed a redirect URL in the response body.
        var redirectTo = (data && data.url) ? data.url : callbackURL;
        window.location.href = redirectTo;
        return;
      }

      var msg = (data && (data.message || data.error)) || 'Invalid email or password.';
      errorBox.textContent = msg;
      errorBox.classList.add('visible');
    } catch (err) {
      errorBox.textContent = 'Network error. Please try again.';
      errorBox.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
})();
`;

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

export interface SignInPageData {
  /** Value to redirect to after a successful sign-in (from `?callbackURL=`). */
  callbackURL: string;
}

function SignInPage({ callbackURL }: SignInPageData): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Sign in · PackRat</title>
        <style>{SIGN_IN_PAGE_STYLES}</style>
      </head>
      <body>
        <main>
          <div class="card">
            <div class="brand">
              <PackratLogo />
              <span class="brand-name">PackRat</span>
            </div>
            <h1>Sign in to PackRat</h1>
            <p class="subtitle">to continue to the MCP connector</p>

            <div id="sign-in-error" class="error" role="alert" aria-live="assertive" />

            <form id="sign-in-form" method="POST" action="/api/auth/sign-in/email" novalidate>
              {/* callbackURL hidden field — used by the no-JS fallback path */}
              <input
                type="hidden"
                name="callbackURL"
                value={isString(callbackURL) ? callbackURL : '/'}
              />

              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
              />

              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                autocomplete="current-password"
                required
                placeholder="••••••••"
              />

              <button type="submit" id="sign-in-submit">
                Sign in
              </button>
            </form>
            <script>{SIGN_IN_SCRIPT}</script>
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

/**
 * Render the sign-in page to a complete HTML5 document string.
 */
export function renderSignInPage(data: SignInPageData): string {
  return `<!DOCTYPE html>${<SignInPage {...data} />}`;
}
