# Live E2E RevenueCat Webhook Test — Runbook

A human-executed test of the **real** RevenueCat webhook path: an actual RevenueCat
purchase fires a real webhook at the running API, writes a real `entitlements` row, and
flips server-side enforcement. The automated suite covers the logic in isolation; this
proves the live delivery + Authorization-header config + end-to-end enforcement.

**Setup for this test:** fully live via RevenueCat's **Test Store** (RC's built-in sandbox —
no App Store / Play Store sandbox account needed), against a **local API exposed with a
cloudflared tunnel**. The enforcement subject is the **catalog** feature.

> ⚠️ **Test scaffolding.** The `catalog` gate (mobile screen + `GET /catalog` server
> enforcement) is throwaway, added only for this test and marked
> `TEST SCAFFOLDING ... remove when done` at both call sites
> (`apps/expo/app/(app)/(tabs)/catalog/index.tsx`,
> `packages/api/src/routes/catalog/index.ts`). Revert it when the test is complete.

## Key contract (verified in code)

- **Webhook endpoint:** `POST /api/webhooks/revenuecat/`
  (`routes/revenuecatWebhook.ts:21`, global `/api` in `routes/index.ts:30,52`).
- **Auth:** exact-string match of the `Authorization` header against
  `REVENUECAT_WEBHOOK_AUTH` (shared secret, **not** a signature) —
  `revenuecatWebhook.ts:26-33`.
- **Body:** `{ "event": { "type", "app_user_id", "entitlement_ids", "expiration_at_ms" } }`
  — `revenuecatWebhook.ts:63`.
- **Responses:** `200 {ok:true,written:n}` · `401 REVENUECAT_WEBHOOK_UNAUTHORIZED` ·
  `400 REVENUECAT_WEBHOOK_BAD_EVENT` · `500 REVENUECAT_WEBHOOK_ERROR`.
- **Grant resolution:** `hasProEntitlement(userId)` = a row with
  `rc_app_user_id = userId AND entitlement_id = 'PackRat Pro' AND is_active AND (expires_at
  IS NULL OR expires_at > now())` — `entitlementsService.ts:153-172`.
- **CRITICAL identity rule:** the webhook's `app_user_id` must equal the app's `users.id`.
  The app ensures this via `Purchases.logIn(user.id)` (`useRevenueCatUser.ts:15`).
  → **Sign in to the app before purchasing.** Purchasing while anonymous sends an anonymous
  RC id and the grant won't resolve to the account.
- **Enforcement (catalog):** `GET /api/catalog/` (auth: Bearer) →
  `enforceFeatureAccess('catalog', user.userId)` → `403 FEATURE_EARLY_ACCESS` for non-Pro
  while `catalog` is in early access — `catalog/index.ts` (scaffolding), `featureGate.ts:22-52`.
  On the client, the catalog tab is wrapped in `<EarlyAccessGate featureKey="catalog">`.

## Prerequisites

- RevenueCat dashboard access to the PackRat project, with a **Test Store** app + the
  Pro product/offering available in Test Store.
- `cloudflared` installed (`brew install cloudflared`).
- Root `.env.local` with a valid `NEON_DATABASE_URL` (dev DB); it generates
  `packages/api/.dev.vars` via `bun install` / `bun run env` (`packages/api/README.md:74`).
- A dev build of the app that can reach the tunnel.
- The catalog test scaffolding present on your branch (see the ⚠️ note above).

## Runbook

### 1. Set the webhook secret locally
- Add to **root `.env.local`**: `REVENUECAT_WEBHOOK_AUTH=<pick-a-strong-secret>`.
- Regenerate dev vars: `bun run env` (or `bun install`) → writes `packages/api/.dev.vars`.
- Confirm: `grep REVENUECAT_WEBHOOK_AUTH packages/api/.dev.vars`.

### 2. Apply the migration to the dev DB (if not already)
- `cd packages/api && bun run db:migrate` — ensures `entitlements` / `feature_access`
  tables exist (migration `drizzle/0050_oval_wind_dancer.sql`).

### 3. Put `catalog` into an early-access window (activates the gate)
- From repo root: `bun packages/api/scripts/feature-access-demo.ts seed catalog 30`
  (`feature-access-demo.ts:94-106`).
- Verify: `bun packages/api/scripts/feature-access-demo.ts show` → `catalog  EARLY ACCESS ...`.
- (Without this row the gate is a no-op / GA — nothing is gated.)

### 4. Run the local API + tunnel
- Terminal A: `cd packages/api && bun run dev` (port 8787).
- Terminal B: `cloudflared tunnel --url http://localhost:8787`
  → note the printed `https://<random>.trycloudflare.com` (the **tunnel base**).
- Smoke-check reachability (expect `401`, proving route + secret path):
  ```
  curl -i -X POST https://<tunnel>/api/webhooks/revenuecat/ \
    -H "Authorization: wrong" -H "Content-Type: application/json" \
    -d '{"event":{"type":"INITIAL_PURCHASE"}}'
  ```

### 5. Point the RevenueCat webhook at the tunnel
- RevenueCat dashboard → Integrations → Webhooks → add/edit:
  - **URL:** `https://<tunnel>/api/webhooks/revenuecat/`
  - **Authorization header:** the exact `REVENUECAT_WEBHOOK_AUTH` value from step 1.
  - **Environment:** Sandbox (Test Store events are sandbox).

### 6. Sign in and make a Test Store purchase
- Launch the dev app and **sign in** as a known account. Record its `users.id` — visible in
  the dev inspector: **Settings → Developer → Paywall State**.
- Open the **Catalog** tab: as a non-Pro user it should now show the early-access paywall
  (client gate active from step 3).
- Complete the RevenueCat **Test Store** purchase of the Pro product from that paywall.
- RevenueCat fires `INITIAL_PURCHASE` → tunnel → local API.

### 7. Verify the grant (webhook → DB)
- Terminal A log shows `POST /api/webhooks/revenuecat 200`.
- Inspect `entitlements` (psql / quick query) for a row:
  `rc_app_user_id = <users.id>`, `entitlement_id = 'PackRat Pro'`, `is_active = true`.
- App: the **Catalog** tab now opens (Pro); Paywall State inspector shows `isPro: yes`.

### 8. Verify enforcement flips (DB → server)
- **Pro allowed:** with a Bearer token for that user,
  ```
  curl -i https://<tunnel>/api/catalog/ -H "Authorization: Bearer <token>"
  ```
  → `200` with the catalog list (past the gate).
- **Revoke:** in the RC dashboard, expire/refund the Test Store purchase (or fire an
  `EXPIRATION`) → webhook `200` → `hasProEntitlement` now false → same catalog call →
  **`403 FEATURE_EARLY_ACCESS`**. In the app, the Catalog tab re-shows the paywall.

### 9. Negative + idempotency checks (curl, same live tunnel)
- **Bad auth** → `401` (step 4).
- **Malformed** (`{"event":{}}` with valid auth) → `400 REVENUECAT_WEBHOOK_BAD_EVENT`.
- **Idempotency:** re-deliver the same `INITIAL_PURCHASE` (RC "resend" button, or curl the
  identical body) → still exactly one active row for that (user, entitlement).

### 10. Teardown (important — this removes the test setup)
- Un-gate: `bun packages/api/scripts/feature-access-demo.ts graduate catalog`
  (or `clear catalog`).
- **Revert the catalog scaffolding** (the two `TEST SCAFFOLDING` edits):
  `git revert 562234ac1` (or manually remove the `EarlyAccessGate` wrapper and the
  `enforceFeatureAccess('catalog', ...)` call + its `403` response entry).
- Remove/disable the RevenueCat sandbox webhook (the tunnel URL is ephemeral anyway).
- Optionally delete the test `entitlements` row.

## Failure triage
- Webhook `401` on a real RC delivery → dashboard Authorization header ≠
  `REVENUECAT_WEBHOOK_AUTH` in `.dev.vars` (re-do step 1, restart `bun run dev`).
- Webhook `200` but catalog still `403` → `app_user_id` ≠ `users.id` (purchased while
  anonymous — the identity rule). Re-purchase while signed in.
- No webhook reaches the API → tunnel down / wrong URL / RC webhook on the wrong environment.
- Catalog `401` → missing/expired Bearer token, unrelated to the gate.
- Catalog never shows a paywall in the app → `catalog` row not seeded (step 3) or the app
  bundle predates the scaffolding (restart Metro with `-c`).

## Success criteria
In order: webhook `200 {ok:true,written:1}` on a real RC delivery → an active `entitlements`
row keyed by `users.id` → `GET /catalog/` returns `200` for that user → after expiry, the same
call returns `403 FEATURE_EARLY_ACCESS`, and the app's Catalog tab flips paywall ↔ content
to match.
