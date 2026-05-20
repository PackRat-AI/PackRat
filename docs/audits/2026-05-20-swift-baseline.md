# Swift app ship-readiness baseline — 2026-05-20

Tracks the as-found state of `apps/swift/` on branch `claude/swift-mac-app-effort-tTGd7` at the start of the ship-readiness stack. Each section is populated by the corresponding unit in `docs/plans/2026-05-20-001-feat-swift-mac-and-ios-ship-readiness-plan.md`.

## Environment

| Item | Value |
|---|---|
| Branch | `claude/swift-mac-app-effort-tTGd7` |
| Branch head | `04bf85d6d` (🧪 fix: get all e2e tests passing) |
| Worktree | `.claude/worktrees/swift-ship-audit/` |
| Divergence vs main | 92 ahead, 904 behind |
| Xcode | 26.5 (Build 17F42) |
| Available iOS runtime | iOS 26.5 only (deployment target in `project.yml` is iOS 17.0) |
| Available macOS runtime | host macOS Tahoe (deployment target is macOS 14.0) |
| xcodegen | 2.45.4 (installed via brew during U1) |
| Simulator used for U2 baseline | iPhone 17 Pro (UDID: 626B2C47-CC06-46AF-8132-70E9D866AEA8) |
| Bun packages | 1763 installed cleanly |

## Build verification (U1)

| Scheme | Configuration | Destination | Result |
|---|---|---|---|
| PackRat-iOS | Debug | iPhone 17 Pro (iOS 26.5) | ✅ `xcodebuild build` exit 0, no errors, 4 warnings (see below) |

### iOS Debug build warnings

Build succeeds but surfaces 4 latent warnings on the current head. None block ship; capturing here so U7 (OpenAPI regen) can clean them up:

- `Sources/PackRat/Features/TrailConditions/TrailConditionsView.swift:98:38` — `??` on non-optional `String` (`report.overallCondition`). Dead defensive check after a generated-type tightening.
- `Sources/PackRat/Features/TrailConditions/TrailConditionsView.swift:200:43` — same pattern, same field.
- `Sources/PackRat/Services/CatalogService.swift:17:34` — `??` on non-optional `[CatalogItem]` (`wrapped.items`).
- `Sources/PackRat/Network/APIClient.swift:137:28` — `await` on a non-async block (`Task { await self.clearRefreshTask() }` inside `defer`).

The first three are signals that the generated OpenAPI types have tightened nullability since the call sites were written — U7's regen will likely shift this further. The last is a minor structural cleanup independent of API contract.
| PackRat-macOS | Debug | platform=macOS | _deferred; runs in U6_ |

## XCUITest baseline (U2)

| Metric | Value |
|---|---|
| Test plan invoked | none — U2 ran the scheme's default test action (pre-U3 layout) |
| Tests collected | 74 |
| Pass | 4 |
| Fail | 70 |
| Skipped | 0 |
| Wall clock | ~36 minutes |
| `xcresult` bundle | malformed — only `Staging/` subdir written (Xcode 26 in-progress format; bundle never finalized because U2 didn't pass `-resultBundlePath`, so the runner streams to DerivedData and the final-write step did not complete cleanly) |

### Root-cause hypothesis

Only 4 tests passed — all from `AuthTests` that don't extend `AppUITestCase` and don't require login:

- `testLoginScreenAppears`
- `testLoginWithBadCredentialShowsError`
- `testLoginButtonDisabledWithEmptyFields`
- `testNavigateToRegisterAndBack`

The single auth-requiring test in `AuthTests` (`testSuccessfulLogin`) **failed**, and every other test failed via the cascade — `AppUITestCase.setUpWithError` calls `loginIfNeeded()`, which throws when the tab bar doesn't appear within 20s, which is exactly what happens when login fails.

**Why login fails on the current setup:** Debug builds in `apps/swift/xcconfig/Config-Debug.xcconfig` set `PACKRAT_ENV=local`, and `APIClient.swift`'s environments dict resolves that to `http://localhost:8787`. The iOS simulator's `localhost` is the host Mac's `localhost`. At test time, port 8787 was bound by a **17-hour-old hung wrangler dev** (PID 58516, started 2026-05-19 21:40, completely unresponsive to HTTP). Every login attempt connected then hung until timeout.

This is not a product defect — it's a test-environment routing issue. Two valid fixes:

1. Kill the hung wrangler on port 8787, start a fresh one (matches `PACKRAT_ENV=local`).
2. Change the test-build config to `PACKRAT_ENV=dev` so it points at `https://packrat-api-dev.orange-frost-d665.workers.dev` — no local dev needed. **This is what the user's earlier "point to our dev api - or spin up local" guidance recommends and what U8 will codify when it lands.**

### Implication for "ship readiness" claim

Until the test-build env routes to a reachable API with valid test credentials, every UI test downstream of `AppUITestCase` is uninformative — failure is environmental, not behavioral. **The "all 74 e2e tests passing" claim on the latest commit (`04bf85d6d`) is unreproducible on a fresh setup unless `localhost:8787` happens to be served by a working dev API at test time** — an undocumented implicit dependency.

#### 2026-05-20 deeper finding: deployed APIs lack user auth

Initial fix (`PACKRAT_ENV=dev`) did not unblock — a fresh iOS-Full run at 21:12 UTC produced the same 4/74 failure profile against `packrat-api-dev.orange-frost-d665.workers.dev`. Direct probing showed:

| Endpoint | Result |
|---|---|
| `POST /api/auth/login` (dev workers.dev) | `404 Not Found` |
| `POST /api/auth/login` (production workers.dev) | `404 Not Found` |
| `POST /api/auth/sign-in/email` (better-auth default — both URLs) | `404 Not Found` |
| `GET /doc` (dev) | `200`, lists only `/api/admin/login` for any auth-shaped route |
| `GET /doc` (production) | `200`, identical to dev — only `/api/admin/login` |

The main-branch API source at `packages/api/src/routes/auth/index.ts` registers `/api/auth/login`, `/api/auth/register`, `/api/auth/verify-email`, `/api/auth/refresh`, `/api/auth/logout`, etc. — but they are not deployed to either workers.dev URL. The deployed APIs predate the auth refactor.

**This is a separate ship-readiness blocker from the audit's scope:**

- The Swift app **cannot authenticate against the currently-deployed dev or production APIs**. Neither environment has user auth.
- Local `wrangler dev` on `:8787` (running latest main source) is the only environment where `/api/auth/login` exists.
- The audit's `PACKRAT_ENV=local` default points there, but **a local wrangler dev must be running** for any auth-dependent test to pass.

#### Recommended remediation

- **Short term**: keep `PACKRAT_ENV=local` (reverted from the brief `dev` flip), run e2e against a fresh local wrangler. Document this in the swift-app README.
- **Medium term**: deploy the current main API (with `/api/auth/*` routes) to the workers.dev dev URL — outside this audit's scope but a hard precondition for any meaningful "ship readiness" claim. Until this happens, the Swift app and the Expo iOS app are both unship-against-deployed-API.
- **Long term**: stand up `api.packrat.app` as a Worker custom domain and migrate clients off `workers.dev`.

### Failing tests (70)

<details>
<summary>Full list — every cascading login-dependent failure</summary>

```text
AuthTests.testSuccessfulLogin
CatalogTests.testCatalogSearchClearable
CatalogTests.testCatalogSearchReturnsResults
CatalogTests.testCatalogShowsEmptySearchPrompt
CatalogTests.testCatalogTabReachable
ChatTests.testChatShowsWelcomeAndInputBar
ChatTests.testChatTabReachable
ChatTests.testClearChatHistoryButton
ChatTests.testSendMessageDisabledWhenEmpty
ChatTests.testSendQuickMessage
FeedTests.testCharacterCounterPresent
FeedTests.testFeedTabReachable
FeedTests.testNewPostButtonOpensComposer
FeedTests.testPostButtonDisabledWithoutCaption
FeedTests.testTypingCaptionEnablesPost
MoreTabsTests.testGearInventoryTabReachable
MoreTabsTests.testGuidesTabReachable
MoreTabsTests.testHomeShowsDashboardSubtitle
MoreTabsTests.testHomeShowsGreeting
MoreTabsTests.testHomeTabReachable
MoreTabsTests.testWildlifeTabReachable
NavigationTests.testAllPrimaryTabsReachable
NavigationTests.testPacksCategoryFilterBarVisible
NavigationTests.testPacksExploreModeToggle
NavigationTests.testPacksNewPackButtonPresent
NavigationTests.testPacksSearchable
NavigationTests.testPacksTabShowsListOrEmpty
NavigationTests.testTripsTabShowsListOrEmpty
NavigationTests.testWeatherTabShowsSearchField
PackSubFlowTests.testGapAnalysisMenuItem
PackSubFlowTests.testPackContextMenuAndCategoryFilter
PackSubFlowTests.testRecentPacksReachableFromPacksToolbar
PackSubFlowTests.testWeightAnalysisReachableFromPackDetailMenu
PackTemplateTests.testCreateTemplate
PackTemplateTests.testNewTemplateButtonOpensForm
PackTemplateTests.testOpenTemplateDetail
PackTemplateTests.testTemplateCategoryPicker
PackTemplateTests.testTemplatesSearchable
PackTemplateTests.testTemplatesTabReachable
PackTests.testAddItemToPack
PackTests.testAddMultipleItems
PackTests.testCreatePack
PackTests.testCreatePackWithCategory
PackTests.testDeletePack
PackTests.testEditPackName
PackTests.testOpenPackShowsDetail
SeasonSuggestionsTests.testGetSuggestionsButtonDisabledWithEmptyLocation
SeasonSuggestionsTests.testOpenSeasonSuggestionsFromHome
SeasonSuggestionsTests.testSeasonSuggestionsHasLocationField
TrailConditionTests.testReportFormHasHazardToggles
TrailConditionTests.testReportFormSubmitDisabledWithoutTrailName
TrailConditionTests.testSubmitReportButtonOpensForm
TrailConditionTests.testSubmitTrailReport
TrailConditionTests.testTrailConditionsTabReachable
TripTests.testCreateTrip
TripTests.testCreateTripWithDates
TripTests.testDeleteTripViaSwipe
TripTests.testOpenTripDetail
TripTests.testPlanTripButtonOpensForm
TripTests.testTripsSearchable
TripTests.testTripsTabShowsListOrEmpty
WeatherSubFlowTests.testAlertPreferencesReachableFromWeatherToolbar
WeatherSubFlowTests.testAlertPreferencesShowsToggles
WeatherSubFlowTests.testToggleAlertPreference
WeatherTests.testForecastShowsDailyRows
WeatherTests.testLocationSearchReturnsResults
WeatherTests.testSavedLocationAppearsAsChip
WeatherTests.testSearchClearButtonRemovesResults
WeatherTests.testSelectLocationLoadsForecast
WeatherTests.testWeatherAlertsButtonAppearsWithForecast
```

</details>

## macOS runtime audit (U6)

_To be populated by U6._

## API client drift (U7)

**Two blockers surfaced during the ce-work parallel pass; U7 cannot proceed as written without addressing both first:**

1. **`bun generate:openapi` is broken on the swift branch.**

   ```text
   $ bun generate:openapi
   error: Cannot find package 'cloudflare:workers' from
     'node_modules/@cloudflare/containers/dist/lib/container.js'
   ```

   Root cause: `packages/api/src/routes/packTemplates/index.ts` imports `getContainer` from `@cloudflare/containers`, whose `container.js` imports the virtual `cloudflare:workers` module. The module is only resolvable inside the Workers runtime. Vitest's unit config aliases it to `packages/api/src/__test-stubs__/cloudflare-workers.ts`; the bun-driven script has no equivalent alias.

   Fix options: (a) add a Bun preload that registers the stub via `--preload`, (b) refactor `@cloudflare/containers` imports to lazy / dynamic so the spec-build path doesn't hit them, or (c) generate the spec from a running `bun api` dev server (curl `/doc`) instead.

2. **The two swift OpenAPI YAML siblings disagree.**

   `apps/swift/openapi.yaml` and `apps/swift/PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml` differ — but `generate-openapi.ts` writes both atomically, so they should be byte-identical. One was likely hand-edited after regen, breaking the build-plugin invariant. U7 must reconcile (likely "regenerate both") before relying on either.

**Implication:** U7's "drop new spec into swift package, run `bun swift:codegen`" approach assumes generate-openapi works. Until blocker 1 is resolved, U7's path is either (a) fix generate-openapi first as a sub-task, (b) curl `/doc` from `bun api` and write the spec manually, or (c) hand-author the spec — which is fragile and reverts what generate-openapi was meant to mechanize.

3. **The swift YAML specs are hand-curated, not generator output.**

   While unblocking via `bun api` on port 8788 + `curl /doc`, the deeper structural issue surfaced:

   - The `/doc` endpoint returns JSON with **0 component schemas** (90 paths). Elysia's OpenAPI plugin uses inline schemas at every route definition, not extracted component refs.
   - The two swift `openapi.yaml` files are **real YAML** starting with `openapi: "3.1.0"` and contain extracted `components.schemas` — hand-curated, more structured than what Elysia emits.
   - `generate-openapi.ts` writes `JSON.stringify(spec, null, 2)` to files named `.yaml`. Those files would not match the format the swift YAML files use.

   **What this means:** the existing `generate-openapi.ts` does not actually produce the YAML files swift consumes. Someone has been hand-authoring or transforming the spec. The "regen" U7 imagines may not exist — U7 is asking to regenerate something that has no clean source-of-truth path.

   **Resolution path for a focused U7 session (not this ce-work session):**
   - Decide canonical authorship: is the swift YAML hand-curated (and stays so), or does generate-openapi need to be rewritten to emit a swift-compatible YAML with extracted component schemas?
   - If hand-curated: rename `generate-openapi.ts` or scope it to JSON-only, and treat the swift YAML as a separately-maintained artifact that the audit must reconcile against the live route surface manually.
   - If auto-generated: rewrite generate-openapi to (a) extract inline schemas into `components.schemas`, (b) emit YAML (not JSON), (c) match the existing swift YAML's structural conventions.
   - Either way, the live `/doc` spec at `localhost:8788/doc` is the source-of-truth of route surface. A diff between that and `apps/swift/PackRatAPIClient/Sources/PackRatAPIClient/openapi.yaml` enumerates the API drift that U8 / decision-artifact need to score.

   **Status:** U7 punted from this session — needs user input on the canonical-authorship direction before further work makes sense.

## URL realignment (U8)

**Precondition check failed.** Per a P1 doc-review finding, U1 probed the URLs the plan commits to:

| URL | DNS | HTTP | Notes |
|---|---|---|---|
| `https://api.packrat.app/` | NXDOMAIN | n/a | The canonical production URL the plan asserts in R4 does not exist |
| `https://staging-api.packrat.app/` | NXDOMAIN | n/a | Likewise — staging domain is not live |
| `https://packrat-api.orange-frost-d665.workers.dev/` | resolves | `HTTP/2 200` | The workers.dev URL the Swift app currently hardcodes IS the live production API |

**Implication for R4 / U8.** The `packages/api/src/utils/openapi.ts` `servers:` list naming `api.packrat.app` is documentation only — the workers.dev URL is the actual production endpoint. R4's literal claim ("production API base URL points to `https://api.packrat.app`") is unsatisfiable until a custom domain is configured on the Cloudflare Worker. U8 cannot deliver as written; needs replanning before execution.

**Decision needed before U8 fires.** Either (a) set up `api.packrat.app` as a custom domain on the Worker (out of audit scope per R10), or (b) restate R4 to track the canonical-by-runtime URL (`packrat-api.orange-frost-d665.workers.dev` today) and document the custom-domain follow-up explicitly. Capturing as a blocker for the U8 task.


## Sentry baseline (U9)

_To be populated by U9._

## Deep linking parity (U10)

_To be populated by U10._

## Feature flag parity (U11)

_To be populated by U11._

## Decision artifact reference (U13)

Final decision lives at `docs/audits/2026-05-20-decision-ios-swap.md`; parity matrix at `docs/audits/2026-05-20-feature-parity-matrix.md`.
