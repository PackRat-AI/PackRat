# Test Plan — Offline-First Early-Access Paywall

Covers the three behaviours that motivated the offline-first / fail-toward-Pro
rework:

1. **Offline "fail-toward-Pro" gating** — a free user can no longer bypass a
   gated feature by killing their connection; a Pro user keeps access offline.
2. **Cold-start UX** — first launch with an empty cache resolves to a definite
   answer (spinner → paywall, or an offline "connect to verify" message),
   never a wrong grant and never a paywall flashed at a possible subscriber.
3. **Server-side enforcement** — the gated route rejects a non-Pro caller even
   if the client is bypassed or tampered with.

---

## Preconditions & fixtures

- A feature configured **in an active early-access window** (`earlyAccessUntil`
  in the future). Call it `wildlife` throughout (it has both a client gate and
  a server route). Set via the admin panel or by seeding `feature_access`.
- A **graduated** feature (`earlyAccessUntil` in the past) for the "opens to
  all" checks.
- Two accounts: **PRO** (active `PackRat Pro` entitlement) and **FREE** (no
  entitlement). For the server tests, PRO must have a row in `entitlements`
  (`isActive = true`, `expiresAt` null or future) — produced by a real purchase
  or by firing the webhook (see §3).
- Signal states to control:
  - **customerInfo**: live (RC reachable), persisted (last-known on disk), or
    absent (never fetched).
  - **feature-access config**: live, persisted, or absent.
  - **connectivity**: online / offline (airplane mode or network link
    conditioner).

> Terminology: **"resolved"** = both the config and the Pro entitlement are
> known from *some* source (live or persisted). The gate only makes a
> grant/deny decision once resolved; before that it waits.

---

## 1. Offline force / fail-toward-Pro gating

Goal: prove uncertainty never unlocks a gated feature for a free user, and
never locks a Pro user out offline.

### 1.1 FREE, was online once, then goes offline (the exploit we're closing)
1. Sign in as FREE, open the app online so config + customerInfo persist.
2. Enable airplane mode.
3. Navigate to the gated `wildlife` screen.
- **Expect**: the paywall is presented (or the gated state shows). The feature
  content is **not** rendered. This is the core regression test for the old
  fail-open bypass.

### 1.2 PRO, online once, then offline (must keep access)
1. Sign in as PRO online (entitlement persists to disk).
2. Enable airplane mode, force-quit, relaunch.
3. Open `wildlife`.
- **Expect**: feature renders immediately, resolved from persisted
  customerInfo. No paywall, no spinner beyond first paint.

### 1.3 PRO whose cached entitlement has EXPIRED
1. PRO with a persisted entitlement whose `expiresAt` is in the past, offline.
2. Open `wildlife`.
- **Expect**: treated as **not** Pro → gated. (Expired cache must not grant.)
  Verifies the `expirationDate` honouring in the persisted-Pro read.

### 1.4 RC fetch fails but config succeeds (partial failure)
1. FREE, online, but block only the RevenueCat customerInfo call (leave the
   config API reachable) — e.g. via a network rule.
- **Expect**: once customerInfo resolves from the SDK's own cache (or, if never
  cached, stays unresolved), the gate never renders the feature for FREE.
  Confirm no "config ok + entitlement missing ⇒ open" leak.

### 1.5 Graduated feature is free for everyone, even offline
1. FREE, offline, open the **graduated** feature.
- **Expect**: renders for free. (Resolver returns GA regardless of Pro.)

### 1.6 Purchase flips the gate without a manual reload
1. FREE on the gated screen → paywall → complete a sandbox purchase.
- **Expect**: `customerInfo` update propagates (listener → cache + persisted),
  gate re-resolves to allowed, feature renders, paywall dismisses.

---

## 2. Cold-start UX (empty cache, first launch)

Goal: nothing persisted yet. Prove the gate reaches a definite state and never
grants wrongly. Clear app storage (or fresh install) before each case.

### 2.1 Cold start, ONLINE, FREE
1. Fresh install, online, sign in as FREE, open `wildlife` immediately.
- **Expect**: brief spinner (block-on-first-fetch) → paywall once resolved.
  Never the feature content.

### 2.2 Cold start, ONLINE, PRO
1. Fresh install, online, sign in as PRO, open `wildlife`.
- **Expect**: brief spinner → feature renders once customerInfo resolves. The
  paywall must **not** flash before resolution.

### 2.3 Cold start, OFFLINE, nothing cached (the hard case)
1. Fresh install. Go offline **before** opening the gated screen. Open it.
- **Expect**: the **"You're offline — connect to verify access"** message with
  **Try again** and **Go back**. **Not** the paywall, **not** the feature.
- **Known gap to verify/observe**: `useConnectivity` starts at `unknown` and
  flips to `offline` only after its probe. During that window the gate shows a
  spinner, then the offline message. Confirm it does land on the message (not
  stay spinning) and note the delay. If the delay is user-visible, that's the
  follow-up: gate on `connectivity === 'offline' || (unknown && fetch failed)`
  or resolve connectivity before first paint.

### 2.4 Cold start offline → then connectivity restored
1. From 2.3 (offline message showing), re-enable network, tap **Try again**.
- **Expect**: refetch resolves; PRO → feature, FREE → paywall.

### 2.5 Cold start offline, tap Go back
1. From 2.3, tap **Go back**.
- **Expect**: routes back; no feature access granted.

### 2.6 `__DEV__` build without RC keys (dev bypass only)
1. Run a dev build with `EXPO_PUBLIC_REVENUECAT_API_KEY` unset.
- **Expect**: gate renders children (dev bypass). **Verify this never triggers
  in a production build** — build a release variant with the key set and repeat
  1.1 to confirm no bypass.

---

## 3. Server-side enforcement (`POST /wildlife/identify`)

Goal: the server rejects a non-Pro caller regardless of the client, using the
`entitlements` table as the source of truth. These are API-level tests
(integration suite / manual curl), independent of the mobile UI.

### 3.1 FREE user is rejected while feature is in early access
1. Ensure `wildlife` is in an active early-access window.
2. Authenticated request as FREE (no active entitlement row) to
   `POST /wildlife/identify`.
- **Expect**: `403` with `code: FEATURE_EARLY_ACCESS`. The expensive
  identification never runs.

### 3.2 PRO user is allowed
1. PRO has an active, unexpired `PackRat Pro` row in `entitlements`.
2. Same request.
- **Expect**: `200` / normal identification path (subject to the existing
  image-ownership check).

### 3.3 Graduated feature — everyone allowed
1. Set `wildlife` `earlyAccessUntil` in the past.
2. FREE request.
- **Expect**: `200` (server resolver returns GA), no 403.

### 3.4 Webhook drives the entitlement state (end to end)
Exercises `POST /webhooks/revenuecat` → `entitlements` → enforcement.
1. **Auth**: request with a missing/wrong `Authorization` header → `401`.
   Malformed body (no `event.type`) → `400`.
2. **Grant**: valid secret + `INITIAL_PURCHASE` for user U with
   `entitlement_ids: ['PackRat Pro']`, future `expiration_at_ms` → `200`,
   `{ ok: true, written: 1 }`. Then `POST /wildlife/identify` as U → allowed.
3. **Idempotency**: re-POST the same event → still exactly one active row; U
   still allowed.
4. **Revoke**: `EXPIRATION` for U → `200`; `POST /wildlife/identify` as U →
   `403`.
5. **Cancellation grace**: `CANCELLATION` with a *future* `expiration_at_ms` →
   U still allowed until that time; with a *past* expiry → denied.
6. **Stale-but-active**: a row with `isActive = true` but past `expiresAt` must
   **not** grant Pro (query requires unexpired). Covered by the unit +
   integration tests; re-verify at the route.

> Automated coverage already present: `resolveActive` / `parseRevenueCatEvent`
> unit tests, and a webhook→Postgres→`hasProEntitlement` integration test
> (auth rejection, idempotency, expiry). Run in the `api-tests` CI suite.

### 3.5 Client-bypass can't beat the server
1. Force the *client* into a wrong-grant state (e.g. a dev build that skips the
   gate, or replay the request directly) as FREE.
2. Call `POST /wildlife/identify`.
- **Expect**: `403`. This is the whole point of server-side enforcement — the
  device is never trusted.

---

## Config-fetch behaviour to assert (supports the above)

- Config is fetched on mount, `staleTime` 5 min, **persisted** to AsyncStorage,
  and refetched on the usual React Query triggers (mount / focus / reconnect)
  once stale. There is **no polling interval**.
- A dev-only settings action refetches both `feature-access` and feature-flag
  queries immediately (bypasses `staleTime`) — use it to make admin-panel
  changes show up without waiting.
- Test implication: after changing `earlyAccessUntil` in the admin panel, a
  running client won't reflect it for up to 5 min unless you background/refocus
  or use the dev refresh. Account for this when validating gating changes.

---

## Regression guardrails (should already be green)

- `packages/config` resolver truth-table tests (in-window + not-Pro ⇒ gated).
- `entitlementsService` unit tests (`resolveActive`, `parseRevenueCatEvent`).
- `revenuecat-webhook` integration test (auth / idempotency / expiry).
- `bun check-types`, `biome check`, `drizzle-kit check`.
