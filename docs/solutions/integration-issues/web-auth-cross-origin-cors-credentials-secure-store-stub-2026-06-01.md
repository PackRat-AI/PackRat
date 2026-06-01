---
title: "Cross-origin web auth silently fails: CORS routing order, missing credentials, and a stubbed expo-secure-store"
date: 2026-06-01
category: docs/solutions/integration-issues/
module: "packages/api, apps/expo (web authentication)"
problem_type: integration_issue
component: authentication
symptoms:
  - "Web users cannot stay logged in; the session never persists across reloads"
  - "All authenticated data calls and Legend-State syncs silently no-op with zero network traffic"
  - "Cross-origin browser blocks auth requests: no Access-Control-Allow-Origin on /api/auth/** routes"
  - "Better Auth getSession() returns null because the HttpOnly session cookie is never sent"
  - "Playwright web-e2e fails at globalSetup with a 404 (POST /api/auth/login)"
root_cause: config_error
resolution_type: code_fix
severity: high
related_components:
  - testing_framework
  - tooling
tags:
  - cross-origin
  - cors
  - better-auth
  - expo-secure-store
  - credentials-include
  - rn-web
  - cloudflare-workers
  - elysia
---

# Cross-origin web auth silently fails: CORS routing order, missing credentials, and a stubbed expo-secure-store

## Problem

The PackRat web app (React Native Web / Expo Router) could not authenticate against the Cloudflare Workers + Elysia + Better Auth API. It rendered but stayed permanently signed-out: every authenticated request and every Legend-State data sync (gated on `isAuthed`) silently failed, and on cross-origin dev/e2e the browser blocked the auth calls outright with a CORS error.

## Symptoms

- web-e2e `globalSetup`: `Better Auth sign-in failed 404` / `Login failed 404` on `POST /api/auth/login`.
- Browser console: `Access to fetch at '.../api/auth/sign-in/email' ... blocked by CORS policy: Response to preflight ... No 'Access-Control-Allow-Origin' header`, followed by `TypeError: Failed to fetch`.
- App renders but never authenticates: `authClient.getSession()` returns `null`, `isAuthed` is never true.
- **Zero** `/api/packs` or `/api/trips` requests fire at all — not even failed ones (mutations are gated on `isAuthed` via `syncedCrud` `waitForSet`).
- Underlying runtime error on web: `ExpoSecureStore.getValueWithKeyAsync is not a function`.

## What Didn't Work

- **Dismissing the failing web-e2e as "e2e noise."** The 404 was real signal — `globalSetup` was POSTing to a `/api/auth/login` route that no longer existed after the Better Auth migration. The harness was surfacing genuine web-auth bugs.
- **Hand-rolling CORS headers (`withAuthCors`) on the pre-Elysia auth dispatch.** Functional but a smell: it duplicated the policy the Elysia `cors` plugin already owned. Replaced by routing auth *through* Elysia so one plugin owns CORS for every route.
- **Seeding `localStorage.user` to force `isAuthed` true.** Racy, and it didn't make data calls fire — because the calls weren't failing at the `isAuthed` gate, they were throwing earlier inside `getAccessToken`. Wrong layer.
- **Inline `Platform.OS === 'web'` guards in `getAccessToken`.** Works, but scatters platform branches. The team convention is a single `lib/` wrapper with a `.web` variant, enforced by lint.

## Solution

Four compounding fixes, all on `feat/web-support-mvp`.

**1. Route `/api/auth/**` through Elysia** (`packages/api/src/index.ts`) so the credentialed `cors` plugin and OPTIONS preflight apply. `auth` is built per-request from Cloudflare env bindings, so a per-request `.all` is used instead of `.mount(auth.handler)`; `parse: 'none'` stops Elysia from consuming the body Better Auth needs.

```ts
.all(
  '/api/auth/*',
  async ({ request }) => {
    const auth = await getAuth(getEnv());
    return auth.handler(request);
  },
  { parse: 'none', detail: { hide: true } },
)
```

**2. Trust localhost origins for CSRF in dev** (`packages/api/src/auth/index.ts`) so the web app on a different localhost port passes Better Auth's CSRF check:

```ts
trustedOrigins: [
  env.BETTER_AUTH_URL,
  'packrat://',
  ...(env.ENVIRONMENT === 'development' ? ['http://localhost:*'] : []),
],
```

**3. Send the session cookie cross-origin on both clients.** Auth client (`apps/expo/lib/auth-client.ts`):

```ts
createAuthClient({ baseURL: getApiBaseUrl(), fetchOptions: { credentials: 'include' }, /* … */ });
```

API client (`packages/api-client/src/index.ts`) — on the no-token (web) path, send the cookie instead of an `Authorization` header:

```ts
// no bearer token on web — the session is an HttpOnly cookie
if (!token) return [base, { ...init, credentials: 'include' }];
```

**4. A non-throwing `secureStore` wrapper with a web variant.** `apps/expo/lib/secureStore.web.ts` backs to `localStorage` and returns `null` for the cookie key (the real session is the HttpOnly cookie):

```ts
function ls(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}
export async function getItemAsync(key: string): Promise<string | null> {
  return ls()?.getItem(key) ?? null;
}
// setItemAsync / deleteItemAsync / getItem / setItem follow the same pattern
```

`packrat.ts`, `auth-client.ts`, and `atomWithSecureStorage.ts` all import from `expo-app/lib/secureStore` instead of `expo-secure-store` directly.

**5. e2e harness rewrite** (`apps/expo/playwright/tests/globalSetup.ts` + `fixtures.ts`): sign in via Better Auth `/api/auth/sign-in/email` in a browser context, save the session-cookie storage state, and have fixtures load it (replacing the dead `/api/auth/login` POST).

## Why This Works

- **expo-secure-store is an empty stub on web** (`ExpoSecureStore.web.js` = `export default {}`). `getItemAsync` ends up calling `undefined(...)` → a `TypeError` thrown *before any fetch*. Since the api client computes `Authorization: Bearer <getAccessToken()>` on every request, that throw killed every `/api/*` call and every `syncedCrud` create/list — which is why there was *zero* API traffic, not failed traffic. The web shim never throws, so the request proceeds.
- **On web there is no JS-readable bearer token.** The Better Auth session lives in an HttpOnly cookie that JavaScript cannot read, so `getAccessToken` legitimately returns `null` on web. Authentication has to ride on the cookie, which only travels cross-origin when the request sets `credentials: 'include'` — hence both clients needed it.
- **The cors plugin was bypassed.** Dispatching `/api/auth/**` to Better Auth's handler *before* Elysia ran meant the `cors` plugin (and its OPTIONS preflight) never touched auth routes, so the cross-origin browser got no `Access-Control-Allow-Origin` and blocked the request. Routing through Elysia puts auth under the same credentialed-CORS policy as everything else.
- **CSRF needs the web origin trusted.** Better Auth rejects cross-origin requests whose `Origin` isn't in `trustedOrigins`. The web app runs on a different localhost port than the API in dev/e2e, so `http://localhost:*` must be trusted (dev only — never production).

## Prevention

- **One wrapper, enforced.** Wrap any module with divergent web behavior in `apps/expo/lib/<name>.ts` + `<name>.web.ts`, and import only from the wrapper. `scripts/lint/no-direct-wrapped-imports.ts` (wired into `lint:custom`) fails the build if a wrapped module (`expo-secure-store`, `expo-apple-authentication`, `expo-updates`) is imported directly outside its wrapper. Add new wrapped modules to its `WRAPPED` map.
- **Route auth through Elysia, never before it.** Any handler mounted ahead of the Elysia app silently loses the shared `cors`, error, and OpenAPI plugins. Keep per-request auth as an `.all('/api/auth/*', …, { parse: 'none' })` route so one plugin owns CORS.
- **Remember: web auth = cookie, not token.** When wiring a new client or fetch path, default to `credentials: 'include'` on the no-token path and expect `getAccessToken` to return `null` on web — don't treat a null token as "unauthenticated."
- **Treat failing e2e as signal, not noise.** The 404 `globalSetup` failure was the first symptom of the whole chain; chasing it (rather than muting it) surfaced the real bugs.

## Related Issues

- `docs/solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md` — same Better Auth + Cloudflare Workers subsystem (per-request factory auth instance), but a build-tooling concern (CLI schema generation) rather than runtime cross-origin auth. Complementary, not overlapping.
- Related learning from the same work (the local e2e DB layer that let these web-auth fixes be validated): the local Neon HTTP proxy (`db.localtest.me` via `packages/api/docker-compose.test.yml` + `maybeConfigureLocalNeon`) replaced raw node-postgres in workerd, which silently drops sockets. Worth a separate solution doc.
