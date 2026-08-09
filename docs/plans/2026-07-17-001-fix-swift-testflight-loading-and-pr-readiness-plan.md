---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
title: "fix: Swift TestFlight loading and PR readiness"
type: fix
status: active
created: 2026-07-17
target_branch: codex/swift-beta-tester-readiness
base_branch: development
product_contract_source: ce-plan-bootstrap
---

# fix: Swift TestFlight loading and PR readiness

## Goal Capsule

Make the Swift beta PR mergeable and prove the TestFlight-like build path is not hiding loading, auth, feature-flag, or production API failures behind local-only E2E fixtures.

## Product Contract

### Problem Frame

The Swift beta branch has substantial iOS, iPad, macOS, and watchOS polish and E2E work, but the user still observes TestFlight loading issues and worries that local tests are not exercising the deployed release path. The active PR is open but GitHub marks it conflicting against `development`, so the branch cannot be safely merged until conflict resolution and production-like validation are complete.

### Requirements

- **R1**: Resolve the PR conflicts against `development` without dropping the Swift beta, visual screenshot, or E2E coverage work.
- **R2**: Reproduce TestFlight-like loading behavior using Release/production API configuration, not only local deterministic E2E fixtures.
- **R3**: Exercise Swift feature flags in at least the canonical default profile and a temporary all-on profile so disabled feature surfaces do not silently rot.
- **R4**: Keep tests honest: do not hide real app/backend bugs by weakening assertions, forcing success states, or seeding user-confusing dummy production data.
- **R5**: Preserve guest and authenticated coverage across iOS, iPad, macOS, and relevant watchOS surfaces where the local tooling supports it.
- **R6**: Ship any fixes as small gitmoji commits to the existing PR branch and watch CI to a decided state.
- **R7**: If unrelated repo-wide checks fail, separate them from the Swift beta readiness path and only hand off to another worktree/subagent when the scope is cleanly separable.

### Acceptance Examples

- **AE1**: Running the Swift E2E workflow manually with `api_environment=production` and `feature_flag_profile=default` reaches authenticated app screens with real production test credentials or fails with a specific app/API defect.
- **AE2**: Running the Swift visual workflow with `api_environment=production` produces iOS, iPad, macOS, and watchOS contact sheets without indefinite loading states on authenticated screens.
- **AE3**: Running local default and all-on feature flag config generation produces expected generated Swift flags and does not leave the working tree dirty after returning to default.
- **AE4**: GitHub PR #2627 no longer reports `CONFLICTING`.

## Scope Boundaries

In scope:
- Conflict resolution for the active Swift beta readiness PR.
- Swift app/API fixes needed to make production-like TestFlight loading, auth, and screenshots work.
- Manual workflow hardening where the deployed validation path needs clearer inputs or artifacts.
- Focused tests for any behavior changes.

Out of scope:
- Expo E2E fixes unrelated to the Swift beta rollout.
- Production database dummy seeding that would confuse testers.
- Apple Developer/App Store Connect account changes unless required to inspect TestFlight metadata.
- Large unrelated repo-wide lint cleanup unless it directly blocks the Swift PR.

## Settled Decisions

- **KTD-session-settled-1**: Validate Swift iOS and macOS first; do not get caught up in Expo web/E2E right now.
  - Provenance: user-directed.
  - Rejected alternative: broaden the current work into Expo web or GitHub Expo E2E repair.
  - Reason: the beta tester risk is the Swift app and TestFlight path.
- **KTD-session-settled-2**: Keep the app local-first and guest-capable, while testing authenticated mode too.
  - Provenance: user-approved.
  - Rejected alternative: gate all useful screens behind auth or test only guest mode.
  - Reason: testers need basic functionality without sign-in, and production issues are often auth-only.
- **KTD-session-settled-3**: Use SwiftUI-native defaults and reusable empty/error/loading patterns.
  - Provenance: user-approved.
  - Rejected alternative: custom controls and inconsistent ad hoc state views.
  - Reason: the desired product feel is Apple-native and maintainable.
- **KTD-session-settled-4**: Use visual contact sheets as a required review artifact.
  - Provenance: user-approved.
  - Rejected alternative: rely only on textual test output.
  - Reason: screenshots revealed error, empty-state, layout, and modal coverage gaps.
- **Report conflicts**: If implementation finds a settled decision is infeasible or harmful, stop for invalidating conflicts; proceed with a documented note for preference-grade conflicts.

## Current Context

- PR #2627 exists: `https://github.com/PackRat-AI/PackRat/pull/2627`.
- Local branch is clean and tracks `origin/codex/swift-beta-tester-readiness`.
- GitHub currently reports PR #2627 as `CONFLICTING`.
- CodeQL checks are green at the latest observed state.
- This worktree originally tracked only the PR branch; fetch refs for `origin/development` and `origin/main` must be available before merge/rebase work.
- Release Swift config uses `PACKRAT_ENV = production`.
- Production API base URL is `https://packrat-api.orange-frost-d665.workers.dev`.
- Local Swift E2E and screenshots can use deterministic local E2E API fixtures, which is useful but does not prove TestFlight behavior.

## Implementation Units

### U1. Resolve base sync and PR conflicts

**Goal:** Bring the branch onto current `development` and make PR #2627 mergeable.

**Requirements:** R1, R6.

**Files:**
- Potentially any conflicted files reported by merging or rebasing `origin/development`.
- Likely conflict candidates: `.github/workflows/swift-e2e.yml`, `.github/workflows/swift-visual.yml`, `apps/swift/project.yml`, Swift test files, and API E2E fixture routes.

**Approach:**
- Fetch `origin/development` explicitly because this worktree uses a narrow fetch refspec.
- Use a non-destructive merge or rebase strategy that preserves the PR branch work and does not revert unrelated user changes.
- Inspect each conflict manually and preserve both development-side updates and Swift beta additions when compatible.
- Regenerate any generated Swift config/project artifacts only through repo scripts.

**Test scenarios:**
- PR conflict state changes from `CONFLICTING` to mergeable after push.
- Local diff still includes the Swift beta screenshot/E2E/watch/app-icon work expected for this PR.
- No conflict markers remain.

**Verification:**
- `git diff --check`.
- `rg -n '<<<<<<<|=======|>>>>>>>'`.
- `gh pr view 2627 --json mergeable`.

### U2. Reproduce TestFlight-like loading locally and in workflow

**Goal:** Determine whether TestFlight loading is a real production API/auth/config bug, a Release build configuration issue, or a workflow coverage gap.

**Requirements:** R2, R4, R5.

**Files:**
- `apps/swift/xcconfig/Config-Release.xcconfig`
- `apps/swift/Sources/PackRat/Network/APIClient.swift`
- `apps/swift/Sources/PackRat/Network/AuthManager.swift`
- `apps/swift/Sources/PackRat/PackRatApp.swift`
- `apps/swift/Tests/PackRatUITests/AppUITestCase.swift`
- `apps/swift/Tests/PackRatUITests/AuthTests.swift`
- `apps/swift/scripts/run-e2e.ts`
- `apps/swift/scripts/run-e2e-macos.ts`
- `apps/swift/scripts/capture-visual-screenshots.ts`
- `.github/workflows/swift-e2e.yml`
- `.github/workflows/swift-visual.yml`

**Approach:**
- Run a production-target smoke path with `PACKRAT_ENV=production` and explicit production `E2E_API_BASE_URL` using existing test credentials when available.
- If credentials are unavailable locally, make the workflow produce a clear missing-secret failure instead of falling back to local fixtures.
- Compare app launch environment, API base URL selection, auth cookie/session handling, and loading/error states between local and production targets.
- Fix any app bug that causes indefinite loading, incorrect connection-needed fallback, or authenticated screens to fail with production-shaped responses.
- Keep production tests read-safe; do not seed production with fake tester-visible records.

**Test scenarios:**
- Guest launch reaches Home without indefinite loading when production API is reachable.
- Authenticated login reaches the authenticated Home/profile/packs surfaces or fails with a specific auth assertion.
- Protected route `401` maps to sign-in-required or logged-out state, not generic connection-needed.
- API/network failures map to reusable centered offline/error states.
- Production API base URL is visible in logs/artifacts without leaking secrets.

**Verification:**
- Local smoke command with `PACKRAT_ENV=production` where credentials exist.
- Manual GitHub workflow run with `api_environment=production`.
- Screenshot catalog review for loading/error states.

### U3. Feature flag matrix hardening

**Goal:** Exercise both default Swift beta flags and an all-on exploratory profile without committing temporary generated flag changes.

**Requirements:** R3, R4, R5.

**Files:**
- `apps/swift/scripts/generate-swift-config.ts`
- `apps/swift/Sources/PackRat/Config/AppFeatureFlags.swift`
- `apps/swift/Tests/PackRatUITests/UITestFeatureFlags.swift`
- `apps/swift/Tests/PackRatUITests/VisualScreenshotTests.swift`
- `.github/workflows/swift-e2e.yml`
- `.github/workflows/swift-visual.yml`

**Approach:**
- Validate generated flags under `default`, `all-on`, and restored `default`.
- Run a focused local all-on screenshot/E2E subset if runtime permits.
- If all-on exposes intentionally incomplete features, either fix the feature enough for the beta or keep it disabled and ensure tests explicitly skip it by generated flag.

**Test scenarios:**
- Default profile reflects canonical app config.
- All-on profile enables every generated Swift flag.
- All-off profile does not crash launch/navigation.
- Generated files return to default before commit unless the product config itself changes.

**Verification:**
- `bun run swift:config`.
- `PACKRAT_SWIFT_FEATURE_FLAG_PROFILE=all-on bun run swift:config`.
- `PACKRAT_SWIFT_FEATURE_FLAG_PROFILE=all-off bun run swift:config`.
- Restore default and verify `git diff` is expected.

### U4. Screenshot/contact-sheet audit for loading and missing states

**Goal:** Produce visual evidence that all major Swift states render correctly under default and production-like configurations.

**Requirements:** R2, R4, R5.

**Files:**
- `apps/swift/scripts/capture-visual-screenshots.ts`
- `apps/swift/Tests/PackRatUITests/VisualScreenshotTests.swift`
- `apps/swift/Sources/PackRat/Shared/ErrorView.swift`
- `apps/swift/Sources/PackRat/Shared/VisualSampleData.swift`
- Feature screens under `apps/swift/Sources/PackRat/Features/**`

**Approach:**
- Run or trigger the visual capture catalog for iOS, iPad, macOS, and watchOS.
- Review contact sheets manually for indefinite spinners, top-aligned empty/error states, missing icons, clipped forms, broken modals, or mislabeled auth/offline states.
- Fix reusable state components before touching individual screens unless a screen has a unique bug.

**Test scenarios:**
- Guest and auth screenshot sets include Home, feature lists, details, forms, empty states, error/offline states, modals, menus, and disabled-feature behavior.
- Auth screenshots with production target do not show broad connection-needed states after successful login.
- Empty/error/loading states are centered and consistent where appropriate.

**Verification:**
- Screenshot artifacts exist as individual images plus contact sheets.
- Visual screenshot test suite passes or reports specific expected skips.

### U5. Focused app/API fixes and tests

**Goal:** Fix real defects uncovered by U2-U4 and protect them with tests.

**Requirements:** R2, R4, R5.

**Files:**
- Determined by the reproduced defect.
- Likely areas: Swift auth/session handling, API response decoding, local/offline state routing, and E2E local worker parity with production responses.

**Approach:**
- Characterize failing behavior first.
- Add or update the narrowest test that would have failed before the fix.
- Fix the app/API behavior rather than hiding failures in screenshot fixtures.
- Keep local E2E fixtures production-shaped enough to catch decoder and status-state bugs.

**Test scenarios:**
- Any fixed loading bug has a unit, UI, or runner test that proves the expected settled state.
- Any API fixture change has a route test.
- Any auth classification change distinguishes unauthenticated, offline, and server-error states.

**Verification:**
- Focused Swift unit/UI tests for changed surfaces.
- Focused API Vitest tests for changed API fixtures/routes.
- `bun run test:swift:scripts`.
- Touched-file lint/checks.

### U6. Optional separate worktree/subagent for unrelated repo-wide failures

**Goal:** Avoid blocking Swift readiness on unrelated checks while still capturing easy independent fixes.

**Requirements:** R7.

**Files:**
- Only files outside the Swift beta PR scope if the failure is clearly unrelated.

**Approach:**
- If repo-wide pre-push checks fail on unrelated Expo/docs/packages, classify the failure.
- If it is easy and isolated, create a separate worktree/branch and fix it independently.
- If it is broad or product-risky, document it as unrelated residual and do not mix it into the Swift PR.

**Test scenarios:**
- Swift PR can be reviewed without unrelated cleanup noise.
- Any separate cleanup branch has its own focused verification.

**Verification:**
- Separate PR or durable note for unrelated residuals.
- Swift PR status remains focused on Swift beta readiness.

## Dependencies and Risks

- Production E2E requires valid production-safe `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` secrets. Without them, the deployed workflow can only prove guest and unauthenticated behavior.
- GitHub-hosted macOS runners may not support every simulator/watchOS runtime needed for the full visual matrix; local machine artifacts remain acceptable for device coverage that GitHub cannot provide.
- Feature flags disabled in canonical config may expose incomplete surfaces under all-on. That is useful signal, not an automatic mandate to ship those features enabled.
- Resolving conflicts may reveal that `development` already changed API or Swift behavior in ways that invalidate earlier local screenshots.

## Verification Plan

- `git diff --check`
- `rg -n '<<<<<<<|=======|>>>>>>>'`
- `bun run test:swift:scripts`
- Focused API Vitest tests for changed API fixture/routes.
- Focused Swift unit/UI/E2E commands for changed Swift surfaces.
- Swift visual screenshot capture for available iOS, iPad, macOS, and watchOS targets.
- Manual GitHub workflow runs for production/default and, if practical, all-on feature flag profiles.
- `gh pr view 2627 --json mergeable,statusCheckRollup`

## Implementation Notes

- Use small gitmoji commits.
- Do not commit temporary all-on/all-off generated Swift flag files.
- Do not put secrets in logs, screenshots, workflow summaries, or committed artifacts.
- Prefer fixing reusable SwiftUI state/form components over one-off per-screen layout patches.
