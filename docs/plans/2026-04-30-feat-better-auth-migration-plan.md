---
title: "feat: Migrate auth to Better Auth with OAuth 2.1 server for MCP"
type: feat
status: active
date: 2026-04-30
---

# Migrate Auth to Better Auth with OAuth 2.1 Server for MCP

## Overview

Replace PackRat's handwritten JWT/refresh-token auth system with **Better Auth** — a TypeScript-first, Cloudflare Workers-compatible auth library. The MCP server gets proper OAuth 2.1 via Cloudflare's `workers-oauth-provider` library, which delegates user authentication to Better Auth. The immediate business driver is enabling MCP clients (Claude Desktop, Cursor) to authorize against PackRat automatically, without manually copying a JWT from a settings page.

**Resolved architectural decisions (from deep research phase):**
- OAuth 2.1 server lives in the **MCP Worker** (`packages/mcp`) using `cloudflare/workers-oauth-provider`. Better Auth in the API Worker serves as the identity provider for the login step.
- `nodejs_als` flag (not full `nodejs_compat`) is sufficient for Better Auth's AsyncLocalStorage dependency.
- The Expo app uses `@better-auth/expo` with the `expoClient` plugin and `bearer()` server plugin for explicit Bearer header flow.

**LOE:** ~10–15 engineering days across 5 phases.

---

## Problem Statement

The current custom auth system has three compounding problems:

1. **MCP requires manual JWT copy.** The MCP server accepts `Authorization: Bearer <jwt>` but issues no OAuth flow. MCP clients (Claude Desktop, Cursor) cannot authorize automatically.
2. **Security gaps.** Apple Sign In currently decodes the identity token payload without verifying the Apple signature (`base64.decode` only, lines 506–511 of `packages/api/src/routes/auth/index.ts`). This is an authentication bypass: any attacker can forge an Apple identity token and call the endpoint.
3. **Maintenance burden.** Every auth feature (2FA, passkeys, scoped permissions) must be handrolled. Better Auth ships these as stable, tested plugins.

---

## Proposed Solution

### API Worker (`packages/api`)
Migrate to **Better Auth** with:
- `emailAndPassword` plugin (bcrypt password override — no forced resets)
- `socialProviders.google` + `socialProviders.apple` (fixes Apple signature verification)
- `bearer()` plugin (Bearer token support for mobile and API clients)
- `jwt()` plugin (short-lived asymmetric JWTs with public JWKS endpoint — for downstream service verification)
- `admin` plugin (maps existing `role: 'ADMIN'` users)
- `@better-auth/drizzle-adapter` targeting existing Neon/Postgres database
- `@better-auth/expo` client in the mobile app

### MCP Worker (`packages/mcp`)
Add `cloudflare/workers-oauth-provider` as the OAuth 2.1 authorization server. It handles PKCE, auth codes, and token issuance locally. The `/authorize` endpoint redirects users to a Better Auth login page on the API. After login, the MCP Worker stores the resulting Better Auth session and issues MCP-scoped access tokens.

---

## Technical Approach

### Resolved: OAuth Server Architecture (Option B)

**Why workers-oauth-provider in the MCP Worker wins:**

The MCP 2025 spec now uses RFC 9728 Protected Resource Metadata. The MCP server must serve `/.well-known/oauth-protected-resource`, and that document can point to an authorization server on any domain. Cross-domain OAuth (Option A) is technically spec-compliant — but it requires Claude Desktop and Cursor to perform a second discovery fetch against the API domain, which is more brittle and less battle-tested in the wild.

Option B (MCP Worker as the OAuth server, Better Auth as the identity provider) cleanly isolates MCP-scoped tokens from main API tokens. The MCP Worker serves both `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` from `mcp.packrat.world`, with zero cross-domain discovery complexity. Token issuance, storage (KV), and validation are all local to the MCP Worker.

```
MCP client (Claude Desktop)
  → GET mcp.packrat.world/.well-known/oauth-authorization-server
  → POST mcp.packrat.world/register  (dynamic client registration)
  → GET mcp.packrat.world/authorize?code_challenge=...
       → redirects to api.packrat.world login page (Better Auth)
       → user authenticates with Better Auth
       → Better Auth issues session token
       → callback returns to mcp.packrat.world/callback?session_token=...
       → MCP Worker verifies session via Better Auth's session API
       → MCP Worker calls env.OAUTH_PROVIDER.completeAuthorization({ userId, scopes })
  → POST mcp.packrat.world/token  (code exchange)
  → MCP tool calls: Authorization: Bearer <mcp-scoped-token>
       → MCP Worker validates token from its own KV store
       → forwards calls to api.packrat.world as a signed service-to-service request
```

### Auth Object Lifecycle in Cloudflare Workers

`betterAuth({...})` requires `env.DB` and `env.KV` which are only available per-request, not at module init. Use a module-level singleton (valid within one isolate) that is initialized lazily on first request:

```typescript
// packages/api/src/auth/index.ts
import { betterAuth } from "better-auth";
import { withCloudflare, createKVStorage } from "better-auth-cloudflare";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

let _auth: ReturnType<typeof betterAuth> | null = null;

export function getAuth(env: Env, cf: IncomingRequestCfProperties) {
  if (!_auth) {
    _auth = betterAuth(
      withCloudflare(
        { cf, kv: env.AUTH_KV, d1: { db: drizzle(env.DB) } },
        {
          secret: env.BETTER_AUTH_SECRET,
          baseURL: env.BETTER_AUTH_URL,
          trustedOrigins: [env.BETTER_AUTH_URL, "https://mcp.packrat.world"],
          // ... plugins
        }
      )
    );
  }
  return _auth;
}
```

**Note:** If `cf` context (geolocation, IP) must be accurate per-request rather than per-isolate, skip the singleton and create the auth object fresh on each request — `betterAuth({...})` is synchronous and cheap.

### Elysia Integration (Concrete Pattern)

Replace the existing `authPlugin` macro with a Better Auth-backed equivalent — zero call-site changes required:

```typescript
// packages/api/src/middleware/auth.ts (replacement)
export const authPlugin = (auth: ReturnType<typeof betterAuth>) =>
  new Elysia({ name: "auth-plugin", aot: false })   // aot: false required with .mount()
    .mount(auth.handler)                              // handles all /api/auth/* routes
    .macro({
      isAuthenticated: {    // existing route API unchanged
        async resolve({ status, request: { headers } }) {
          const session = await auth.api.getSession({ headers });
          if (!session) return status(401);
          return { user: session.user, session: session.session };
        },
      },
    });
```

### CORS Configuration

```typescript
// @elysiajs/cors — both settings are required
cors({
  origin: [env.BETTER_AUTH_URL, "https://mcp.packrat.world"],
  credentials: true,        // REQUIRED — omitting breaks all cookie/bearer auth
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
})

// Better Auth config — must match CORS origin
betterAuth({
  trustedOrigins: [env.BETTER_AUTH_URL, "https://mcp.packrat.world"],
})
```

`credentials: true` + `origin: *` is rejected by browsers. `allowedHeaders` must include `Authorization` for the `bearer()` plugin to work.

### Cloudflare Workers Flags

```toml
# packages/api/wrangler.toml
compatibility_flags = ["nodejs_als"]    # narrower than nodejs_compat; sufficient for Better Auth
compatibility_date = "2024-09-23"       # required for nodejs_als
```

`nodejs_als` enables only `AsyncLocalStorage` — Better Auth's sole Node.js dependency. Avoid the full `nodejs_compat` flag unless a plugin adds a hard Node.js API dependency (e.g., a nodemailer-based email sender).

### Schema Migration Strategy

Better Auth needs: `user`, `session`, `account`, `verification`, `jwks` tables. Map to the existing `users` table via schema override:

```typescript
drizzleAdapter(db, {
  provider: "pg",
  schema: {
    ...betterAuthSchema,
    user: schema.users,   // reuse existing table — preserves all foreign keys
  },
  usePlural: true,
})
```

Add `additionalFields` for the `role` column:
```typescript
user: {
  additionalFields: {
    role: { type: ["USER", "ADMIN"], required: false, defaultValue: "USER", input: false }
  }
}
```

Add missing columns to `users` via migration: `image text`, `updated_at timestamp`. All legacy tables (`auth_providers`, `refresh_tokens`, `one_time_passwords`) are preserved until Phase 5 cleanup.

### KV as Secondary Storage — Rate Limit TTL

Cloudflare KV enforces a hard minimum `expirationTtl` of 60 seconds. All Better Auth rate limit windows must be `≥ 60`:

```typescript
rateLimit: {
  enabled: true,
  customRules: {
    "/sign-in/email":   { window: 60, max: 5 },
    "/sign-up/email":   { window: 60, max: 3 },
    "/forget-password": { window: 60, max: 3 },
  },
}
```

For sub-60s burst protection, use Cloudflare's native Rate Limiting rules at the edge (not in Worker code).

---

## Implementation Phases

### Phase 0: Security prerequisite (1 day) — before Phase 2

**Backport Apple signature verification into the legacy endpoint** before opening the parallel operation window. The current `base64.decode`-only path is an authentication bypass. An attacker with access to the legacy endpoint can forge any Apple identity and create a valid session. This must be fixed regardless of migration timeline.

- [ ] In `packages/api/src/routes/auth/index.ts`, replace the base64-decode-only Apple handling with proper JWT signature verification using Apple's public keys from `appleid.apple.com/auth/keys`
- [ ] Add `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` to `packages/env/src/node.ts` and `packages/api/src/utils/env-validation.ts` (needed for both legacy fix and Better Auth Apple provider)
- [ ] Obtain `.p8` private key from Apple Developer portal, store as Cloudflare Worker secret (`wrangler secret put APPLE_PRIVATE_KEY`) — not in `.env`

---

### Phase 1: Foundation (2–3 days)

**Goal:** Better Auth running alongside existing auth, zero traffic.

- [ ] Add `compatibility_flags = ["nodejs_als"]` and `compatibility_date = "2024-09-23"` to `packages/api/wrangler.toml`
- [ ] Install: `better-auth`, `@better-auth/drizzle-adapter`, `@better-auth/expo`, `better-auth-cloudflare`
- [ ] Create `packages/api/src/auth/config.ts` — Better Auth config with all plugins (not yet mounted)
- [ ] Add env vars to `packages/env/src/node.ts` and `packages/api/src/utils/env-validation.ts`:
  - `BETTER_AUTH_SECRET` (required, min 32 chars)
  - `BETTER_AUTH_URL` (required, API base URL e.g. `https://api.packrat.world`)
  - `APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` (if not done in Phase 0)
- [ ] Write Drizzle migration `packages/api/drizzle/0038_better_auth_tables.sql`:
  - Add `image text`, `updated_at timestamp` to `users`
  - Create `session`, `account`, `verification` tables
  - Create `jwks` table (for `jwt()` plugin key rotation)
- [ ] Wire `auth.handler` into Elysia via `authPlugin(getAuth(env, cf))` — mounted at `/api/auth/*`, zero routing change to existing routes
- [ ] Deploy to staging, verify:
  - `GET /api/auth/ok` → 200
  - `GET /api/auth/jwks` → valid JWKS key set
  - `POST /api/auth/sign-in/email` → issues session token
- [ ] Store `BETTER_AUTH_SECRET` as a Cloudflare Worker secret

**Files:**
- `packages/api/wrangler.toml`
- `packages/api/src/auth/config.ts` *(new)*
- `packages/api/src/middleware/auth.ts` *(refactor to Better Auth macro)*
- `packages/api/src/index.ts` *(mount auth handler)*
- `packages/env/src/node.ts`, `packages/api/src/utils/env-validation.ts`
- `packages/api/drizzle/0038_better_auth_tables.sql` *(new)*

---

### Phase 2: Parallel operation + data migration (3–4 days)

**Goal:** New sign-ins go through Better Auth. Old JWTs still work for up to 7 days.

- [ ] Implement dual-auth middleware:
  ```typescript
  async function resolveUser(headers: Headers, env: Env, cf: CF) {
    const session = await getAuth(env, cf).api.getSession({ headers });
    if (session) return session.user;
    return verifyLegacyJWT(headers, env);  // existing verifyJWT() — keep alive
  }
  ```
- [ ] Write idempotent one-time user migration script `packages/api/scripts/migrate-to-better-auth.ts`:
  - Copy `users` rows into Better Auth's `user` table (using `forceAllowId: true` to preserve numeric IDs)
  - Copy `auth_providers` rows into `account` table: map `provider`→`providerId`, `providerId`→`accountId`; for email accounts, copy `passwordHash` into `account.password`
  - Mark all migrated users `emailVerified: true` (they already verified)
  - Cache Apple users' email from `auth_providers` into the `account` record (Apple omits email after first auth — cache it now or it's gone)
  - Script must be idempotent: `INSERT ... ON CONFLICT (id) DO NOTHING`
  - Log before/after row counts; abort if delta > 1%
- [ ] Run migration script in production after Phase 1 stabilizes
- [ ] Switch new login/register calls to Better Auth endpoints:
  - `POST /api/auth/sign-in/email` (replaces `POST /api/auth/login`)
  - `POST /api/auth/sign-up/email` (replaces `POST /api/auth/register`)
  - `POST /api/auth/sign-in/social` with `provider: "google"` / `"apple"`
- [ ] Keep old auth routes alive during overlap for clients still holding legacy JWTs
- [ ] Monitor: Better Auth session hit rate, legacy JWT fallback rate (structured logs); alert if legacy rate goes to zero before 7-day window closes (indicates clients updated faster than expected)
- [ ] Audit `PASSWORD_RESET_SECRET` usage — grep across all packages; it is declared in env schema but not imported in `utils/auth.ts`

**Critical gap:** Normalize response timing in the dual-auth shim to prevent timing oracles. If Better Auth session lookup fails fast (KV miss) and legacy HMAC lookup fails slow (DB + constant-time compare), attackers can distinguish the two paths by latency. Use a fixed minimum response time or always run both paths concurrently.

**Files:**
- `packages/api/src/middleware/auth.ts`
- `packages/api/scripts/migrate-to-better-auth.ts` *(new)*
- `packages/api/src/routes/auth/index.ts` *(mark old endpoints deprecated, keep alive)*

---

### Phase 3: MCP OAuth 2.1 server (2–3 days)

**Goal:** Claude Desktop / Cursor can authorize against PackRat via standard OAuth 2.1.

- [x] Install `@cloudflare/workers-oauth-provider` in `packages/mcp`
- [x] Wrap MCP Worker entrypoint with `OAuthProvider`:
  ```typescript
  import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
  export default new OAuthProvider({
    apiRoute: "/mcp",
    apiHandler: mcpApiHandler,
    defaultHandler: PackRatAuthHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    allowPlainPKCE: false,  // S256 only
    accessTokenTTL: 3600,   // 60 minutes
  });
  ```
- [x] Implement `PackRatAuthHandler` in `packages/mcp/src/auth.ts`:
  - `/authorize` → stores OAuth state in KV, redirects to `/login`
  - `GET /login` → serves sign-in HTML form
  - `POST /login` → calls Better Auth sign-in API (server-to-server), stores session token in KV, redirects to `/callback`
  - `/callback` → retrieves OAuth state + session from KV, calls `env.OAUTH_PROVIDER.completeAuthorization({ userId, props: { betterAuthToken } })`
- [x] Configure MCP access token lifetime at **60 minutes** via `accessTokenTTL: 3600`; refresh tokens at 30 days
- [x] Implement PKCE enforcement: `allowPlainPKCE: false` — only S256 accepted
- [x] Implement backward compatibility: `resolveExternalToken` accepts legacy Better Auth session tokens directly (no OAuth flow needed for existing clients)
- [x] Add `OAUTH_KV` KV binding to `wrangler.jsonc` (placeholder IDs to replace before deploy)
- [ ] Configure dynamic client registration security: require an initial access token — **do not allow open unauthenticated registration in production**
- [ ] Redirect URI exact-match validation (handled by `workers-oauth-provider` library)
- [ ] Pre-register Claude Desktop and Cursor as trusted clients (bypass consent screen for known clients)
- [ ] Add deprecation banner to PackRat settings UI for manually-issued MCP JWTs

**Files:**
- `packages/mcp/package.json` *(add @cloudflare/workers-oauth-provider)*
- `packages/mcp/src/index.ts` *(wrap with OAuthProvider)*
- `packages/mcp/src/auth.ts` *(new — authorize + callback handler)*
- `packages/mcp/wrangler.toml` *(add KV binding for OAuth token storage)*
- PackRat settings UI *(deprecation notice)*

---

### Phase 4: Client updates (2–3 days)

**Goal:** Expo app and Next.js apps use Better Auth sessions natively. Fix dual-read token path.

**Expo (`apps/expo`):**

- [ ] Install `@better-auth/expo`, `expo-secure-store`, `expo-linking`, `expo-web-browser`, `expo-constants`
- [ ] Create `apps/expo/lib/auth-client.ts`:
  ```typescript
  import { createAuthClient } from "better-auth/react";
  import { expoClient } from "@better-auth/expo/client";
  import { bearer } from "better-auth/plugins";

  export const authClient = createAuthClient({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
    plugins: [
      expoClient({ scheme: "packrat", storagePrefix: "packrat" }),
      bearer(),
    ],
  });
  ```
- [ ] Fix dual-read bug: **`packrat.ts` and `authAtoms.ts` must both read through `authClient.getSession()`** — never via direct `Storage.getItem`. Jotai atoms derive from `authClient`:
  ```typescript
  export const sessionAtom = atom(async () => {
    const { data } = await authClient.getSession();
    return data;
  });
  ```
- [ ] Add version-keyed migration gate on app launch to force re-auth for old-format tokens:
  ```typescript
  const authVersion = await Storage.getItem("auth_version");
  if (authVersion !== "v2") {
    await Storage.removeItem("access_token");
    await Storage.removeItem("refresh_token");
    await Storage.setItem("auth_version", "v2");
    // navigate to login screen
  }
  ```
- [ ] Handle 401 → graceful re-login: the `needsReauthAtom` must surface a re-login modal, not leave the app in a broken state
- [ ] Update `useAuthActions.ts` to call `authClient.signIn.email`, `authClient.signIn.social`, `authClient.signOut`, etc.
- [ ] Google Sign In: use `@react-native-google-signin/google-signin` native ID token flow:
  ```typescript
  const response = await GoogleSignin.signIn();
  if (isSuccessResponse(response) && response.data.idToken) {
    await authClient.signIn.social({
      provider: "google",
      idToken: { token: response.data.idToken },
    });
  }
  ```
- [ ] Apple Sign In: use the native `expo-apple-authentication` flow and pass `identityToken` to `authClient.signIn.social({ provider: "apple", idToken: { token } })`
- [ ] Test OTP email verification, forgot-password, and resend-verification against Better Auth endpoints

**Next.js apps (`apps/admin`, `apps/guides`):**
- [ ] Add `better-auth/react` client
- [ ] Replace manual cookie/JWT handling with `authClient.getSession()`
- [ ] Verify `set-cookie` from Better Auth is accepted (cookie name, SameSite, Secure, domain)
- [ ] Update auth guards/middleware in both apps

**Files:**
- `apps/expo/lib/auth-client.ts` *(new)*
- `apps/expo/lib/api/packrat.ts` *(remove direct Storage.getItem)*
- `apps/expo/features/auth/atoms/authAtoms.ts` *(derive from authClient)*
- `apps/expo/features/auth/hooks/useAuthActions.ts`
- `apps/expo/features/auth/hooks/useAuthInit.ts`
- `apps/admin/...`, `apps/guides/...` *(auth client + guard updates)*

---

### Phase 5: Cutover + cleanup (1–2 days)

**Prerequisite:** 7 days have elapsed since Phase 2 deploy. Legacy JWT hit rate in logs is 0%. Expo app update has shipped and adoption is sufficient (confirm in analytics).

- [ ] Remove legacy JWT validation from dual-auth middleware
- [ ] Remove deprecated old auth routes (`/api/auth/login`, `/api/auth/register`, `/api/auth/google`, `/api/auth/apple`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`)
- [ ] Remove legacy auth utilities from `packages/api/src/utils/auth.ts`: `generateJWT`, `verifyJWT`, `generateRefreshToken`. **Keep:** `isValidApiKey` (admin X-API-Key), `hashPassword`/`verifyPassword` (still used by Better Auth config)
- [ ] Remove `PASSWORD_RESET_SECRET` from env schema if confirmed unused
- [ ] Drop legacy tables in follow-up migration `0039_drop_legacy_auth_tables.sql`:
  - `DROP TABLE refresh_tokens`
  - `DROP TABLE auth_providers`
  - `DROP TABLE one_time_passwords`
- [ ] Remove old auth test files and replace with Better Auth-aware integration tests
- [ ] Update `packages/mcp/src/__tests__/auth.test.ts` to test OAuth 2.1 flow end-to-end
- [ ] Update `packages/api/test/auth.test.ts` to test Better Auth sign-in, social auth, OTP flows

---

## System-Wide Impact

### Interaction Graph

```
New sign-in (email):
  → POST /api/auth/sign-in/email
  → Better Auth validates password (bcrypt override)
  → Writes session row to `session` table in Neon
  → Returns opaque session token in `set-auth-token` header (bearer() plugin)
  → Mobile stores token; subsequent requests: Authorization: Bearer <token>
  → getSession() looks up session in Neon on every API request

MCP OAuth 2.1 flow:
  → Client discovers mcp.packrat.world/.well-known/oauth-authorization-server
  → Client POSTs to /register (with initial access token)
  → Client opens browser to /authorize?code_challenge=<S256_hash>
  → MCP Worker redirects to api.packrat.world login page (Better Auth)
  → User authenticates → Better Auth session issued
  → Callback: MCP Worker verifies session via api.packrat.world/api/auth/get-session
  → completeAuthorization({ userId }) → auth code → /token exchange
  → MCP-scoped access token stored in MCP Worker's KV
  → Tool calls: Bearer <mcp-token> → validated from KV → forwarded to API
```

### Error & Failure Propagation

- **Better Auth session lookup fails (DB down):** `getSession()` throws → dual-auth middleware must catch and return 503, not 401. Clients retrying on 503 vs 401 need different backoff behavior. Document this in client error handling.
- **JWKS key rotation mid-session (MCP):** Stale cached key causes JWT verification failure. On failure: re-fetch JWKS once (background `ctx.waitUntil`), retry verification. If still fails, return 401 with `error: "token_expired"` — client must re-authorize.
- **MCP access token expiry during agentic session:** Token expires at 60 min. MCP client must implement proactive refresh at 48 min (80% of lifetime) using the refresh token grant. If client doesn't implement refresh, tool calls fail at the 60-min mark with no recovery path — this is a known hard failure mode for long-running agentic sessions.
- **Better Auth migration script partial failure:** Use `INSERT ... ON CONFLICT DO NOTHING`. Run with `--dry-run` against a production DB snapshot first. Validate row counts before and after. Do not proceed to Phase 2 until 100% of users are migrated.
- **Legacy OTP in-flight at cutover:** A password-reset OTP requested before cutover lives in the legacy `one_time_passwords` table. Better Auth has no visibility into it. Schedule Phase 5 cutover during off-peak hours, announce 1-hour maintenance window, accept ≤15 min of broken OTP links (OTP TTL is 15 min).

### State Lifecycle Risks

| Risk | State stranded | Mitigation |
|---|---|---|
| Apple re-auth after migration | `email` / `name` not returned by Apple on 2nd+ auth | Cache Apple email into `account` record during migration script |
| Active OTP at Phase 5 cutover | OTP in `one_time_passwords` table, invisible to Better Auth | Schedule cutover at off-peak; OTP TTL is 15 min |
| Expo users with v1 tokens | `access_token` in expo-sqlite, invalid format for Better Auth | Version-gate migration in app launch sequence (Phase 4) |
| MCP pre-issued JWTs | Orphaned at Phase 5 cutover | Deprecation banner at Phase 3; force 401 at Phase 5 |
| Dual-read race condition | Two concurrent requests both hit legacy path, create duplicate sessions | KV atomic write for session promotion (compare-and-swap) |

### API Surface Parity

| Current endpoint | Better Auth equivalent | During overlap |
|---|---|---|
| `POST /api/auth/login` | `POST /api/auth/sign-in/email` | Keep alive |
| `POST /api/auth/register` | `POST /api/auth/sign-up/email` | Keep alive |
| `POST /api/auth/verify-email` | `POST /api/auth/verify-email` | Better Auth path takes over |
| `POST /api/auth/forgot-password` | `POST /api/auth/forget-password` (note spelling) | Keep old alive |
| `POST /api/auth/reset-password` | `POST /api/auth/reset-password` | Same path |
| `POST /api/auth/refresh` | Implicit via session lookup (no explicit endpoint) | Keep legacy alive |
| `POST /api/auth/logout` | `POST /api/auth/sign-out` | Keep old alive |
| `GET /api/auth/me` | `GET /api/auth/get-session` | Keep old alive |
| `POST /api/auth/google` | `POST /api/auth/sign-in/social?provider=google` | Keep old alive |
| `POST /api/auth/apple` | `POST /api/auth/sign-in/social?provider=apple` | Keep old alive + fix sig verification in Phase 0 |
| `DELETE /api/auth/` | `POST /api/auth/delete-user` | Keep old alive |
| `POST /api/auth/resend-verification` | `POST /api/auth/send-verification-email` | Keep old alive |
| X-API-Key admin routes | Unchanged — `apiKeyAuthPlugin` stays | No migration needed |

### Integration Test Scenarios

1. **Legacy JWT accepted during overlap:** Issue JWT via old `/api/auth/login`, call a protected route → should succeed via fallback path. Issue Better Auth session → should also succeed. Both paths in a single test run.
2. **Apple re-authentication:** Existing Apple user (migrated account row). Signs in via Apple again — Better Auth must match on `accountId` (Apple `sub`), not `email` (omitted by Apple on 2nd auth).
3. **MCP full OAuth 2.1 flow:** Simulate Claude Desktop: discover → register (with initial access token) → authorize (PKCE S256) → login via Better Auth → token exchange → MCP tool call → verify tool response.
4. **MCP token expiry mid-session:** Issue MCP token, advance time past 60-min lifetime, make a tool call → expect 401 with refresh token grant → refresh → retry succeeds.
5. **Parallel session collision:** Two concurrent requests with the same legacy token both hit the dual-auth shim simultaneously. One should promote to a Better Auth session; the second should not create a duplicate.

---

## Security Summary

Issues found during the deepening research phase, ordered by severity:

| Finding | Severity | Phase to fix |
|---|---|---|
| Apple identity token not signature-verified (current prod bug) | **Critical** | Phase 0 (before anything else) |
| PKCE `plain` method must be rejected by oauthProvider plugin | **Critical** | Phase 3 — verify during config |
| Open dynamic client registration allows attacker-controlled redirect URIs | **High** | Phase 3 — require initial access token |
| Legacy Apple endpoint exploitable during parallel window if not fixed first | **High** | Phase 0 eliminates this |
| MCP token expires during long agentic sessions (60s default is 15 min) | **High** | Phase 3 — set to 60 min + proactive refresh |
| Timing oracle in dual-auth shim (Better Auth fast miss vs legacy slow DB lookup) | **Medium** | Phase 2 — normalize response timing |
| JWKS thundering herd on key rotation expiry | **Medium** | Phase 3 — stale-while-revalidate pattern |
| Duplicate session creation via concurrent legacy token promotion | **Medium** | Phase 2 — KV atomic write |

---

## Acceptance Criteria

### Functional
- [ ] Users can sign in with email/password, Google, and Apple without a password reset
- [ ] Apple identity token is signature-verified (not just base64-decoded)
- [ ] `GET /api/auth/jwks` returns a valid Ed25519 JWKS key set
- [ ] `GET mcp.packrat.world/.well-known/oauth-authorization-server` returns RFC 8414 metadata
- [ ] Claude Desktop and Cursor complete OAuth 2.1 + PKCE flow without manual token copy
- [ ] MCP tool calls succeed with OAuth-issued tokens
- [ ] Dynamic client registration requires an initial access token (not open)
- [ ] Admin `X-API-Key` routes work unchanged throughout all phases
- [ ] Legacy JWTs work for their remaining TTL during Phase 2–4 overlap
- [ ] After Phase 5, legacy JWTs are rejected with 401

### Non-Functional
- [ ] No forced password resets for existing users
- [ ] Session lookup adds < 10ms p99 latency (Neon with Hyperdrive connection pooling)
- [ ] MCP JWKS cache uses stale-while-revalidate (no hard TTL thundering herd)
- [ ] `nodejs_als` flag does not regress other Worker functionality (verify in staging)

### Quality Gates
- [ ] All existing auth tests pass or are replaced with Better Auth-equivalent tests
- [ ] New integration test covers full OAuth 2.1 PKCE flow for MCP
- [ ] Apple re-auth tested with no-email response from Apple (second sign-in simulation)
- [ ] Dual-auth shim timing normalized — no measurable latency oracle between paths
- [ ] `APPLE_PRIVATE_KEY` and `BETTER_AUTH_SECRET` stored as Worker secrets (not committed)
- [ ] `PASSWORD_RESET_SECRET` usage audited and resolved

---

## Dependencies & Prerequisites

- **Apple credentials** — `.p8` private key, Team ID, Key ID from Apple Developer portal. Must be in place before Phase 0.
- **`nodejs_als` compatibility** — verify staging Worker builds and deploys successfully before production.
- **Expo release cadence** — Phase 4 Expo changes need a shipped release before Phase 5 cutover. Gate Phase 5 on sufficient app version adoption (target: ≥ 80% of DAU on v2).
- **Neon connection pool** — Better Auth makes more frequent session table reads than the old stateless JWT system. Verify connection pool size (Hyperdrive) is adequate for the added load.
- **Initial access token provisioning** — a mechanism to issue initial access tokens for MCP client registration must exist before Phase 3 (even a one-time admin script is fine).

---

## Future Considerations

Once stabilized:
- **2FA / TOTP:** Better Auth `twoFactor()` plugin — add after migration settles.
- **Passkeys:** Better Auth `passkey()` plugin — high-value for mobile.
- **MCP scopes:** Define PackRat-specific OAuth scopes (`trails:read`, `packs:write`, `trips:read`) for granular MCP agent permissions.
- **Organization auth:** Better Auth `organization()` plugin — relevant if PackRat adds team/family sharing features.

---

## Sources & References

### Internal References
- Apple auth bypass (current): `packages/api/src/routes/auth/index.ts:506–511`
- Auth utilities: `packages/api/src/utils/auth.ts`
- Auth middleware: `packages/api/src/middleware/auth.ts`
- DB schema: `packages/api/src/db/schema.ts:338` (trailOsmId / users / auth_providers / refresh_tokens)
- MCP auth extraction: `packages/mcp/src/index.ts:80–88`
- Expo token storage: `apps/expo/features/auth/atoms/authAtoms.ts`
- Expo token dual-read bug: `apps/expo/lib/api/packrat.ts`
- Env schema: `packages/api/src/utils/env-validation.ts`, `packages/env/src/node.ts`

### External References
- [Better Auth — Cloudflare Workers integration](https://better-auth.com/docs/integrations/cloudflare)
- [Better Auth — Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth — OAuth provider plugin](https://better-auth.com/docs/plugins/oauth-provider)
- [Better Auth — jwt() plugin](https://better-auth.com/docs/plugins/jwt)
- [Better Auth — bearer() plugin](https://better-auth.com/docs/plugins/bearer)
- [Better Auth — Expo / React Native client](https://better-auth.com/docs/installation) (react-native section)
- [Better Auth — Migration guides](https://better-auth.com/docs/guides)
- [Better Auth — bcrypt issue #5016](https://github.com/better-auth/better-auth/issues/5016)
- [better-auth-cloudflare package](https://github.com/zpg6/better-auth-cloudflare)
- [cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)
- [Cloudflare — Build a Remote MCP server with OAuth](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Cloudflare — MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)
- [MCP Authorization spec (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [MCP Authorization spec (draft — RFC 9728 Protected Resource Metadata)](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 7591 — Dynamic Client Registration](https://www.rfc-editor.org/rfc/rfc7591)
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [Building an MCP server with OAuth + Cloudflare — Stytch](https://stytch.com/blog/building-an-mcp-server-oauth-cloudflare-workers/)
