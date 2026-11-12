# Swift E2E Runner

This repo has two iOS-era app stacks for now:

- Expo app: production iOS app, covered by Maestro in `.github/workflows/e2e-tests.yml`.
- Swift app: native macOS app first, with exploratory Swift iOS coverage, covered by XCTest/XCUITest in `.github/workflows/swift-e2e.yml`.

Do not move the Swift app to Maestro. XCUITest is the native Apple UI automation layer and gives better result bundles, accessibility hierarchy data, simulator integration, and macOS app coverage.

## GitHub Runner

The macOS and iOS Swift UI suites run on GitHub-hosted `macos-26` runners. The workflow pins Xcode through `XCODE_VERSION`, which must be new enough for the tools version every pinned package declares (mlx-swift needs Xcode 26.4 or later). Each macOS run enables Automation Mode without authentication before the tests start, since a hosted runner has no state carried over from earlier runs.

The manual TestFlight replacement archive verification job runs on `macos-26` as well. It imports the distribution certificate, the iOS and watch App Store profiles and the App Store Connect API key from the same secrets `release-apple.yml` uses, then deletes them when the job ends.

## Required Secrets

Set these GitHub repository secrets:

```text
E2E_TEST_EMAIL
E2E_TEST_PASSWORD
SWIFT_E2E_API_BASE_URL
NEON_DEV_DATABASE_URL
PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN
```

`SWIFT_E2E_API_BASE_URL` should point at a stable dev or staging API. Localhost is fine for manual local runs, but CI should prefer a deployed test API unless the runner also starts and owns a local API process.

## Workflow Behavior

Pull requests:

- Run `bun run e2e:swift:mac-smoke` on a GitHub-hosted macOS runner.
- Upload `.xcresult`, screenshots, and failure triage artifacts.

Pushes to `main` or `development`, scheduled runs, and manual macOS runs:

- Run `bun run e2e:swift:mac-ui`.
- Treat this as the primary Swift app confidence signal.

Scheduled runs and manual iOS runs:

- Run `bun run e2e:swift:ios`.
- Keep this separate from Expo/Maestro because the Swift iOS app is exploratory while the Expo iOS app remains active.

## Local Commands

```sh
bun swift
bun run test:swift:runner
bun run test:swift:unit
E2E_API_BASE_URL=http://localhost:8788 bun run e2e:swift:mac-smoke
E2E_API_BASE_URL=http://localhost:8788 bun run e2e:swift:mac-ui
E2E_API_BASE_URL=http://localhost:8788 bun run e2e:swift:ios-smoke
E2E_API_BASE_URL=http://localhost:8788 bun run e2e:swift:ios
```

The runner injects `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_API_BASE_URL`, and `E2E_SCREENSHOT_DIR` into the generated Xcode schemes at runtime. It redacts credential-like values from `xcodebuild` output.

## Data Hygiene

Current Swift UI tests isolate data by creating records with unique names and IDs. This makes repeated runs safe, but it can leave historical test data in the shared E2E account.

If the E2E account becomes noisy, add one of these:

- API cleanup helpers that delete records created with the current run prefix.
- A test-only reset endpoint available only in development/staging.
- Dedicated test tenancy per run if backend isolation becomes critical.

Until then, avoid assertions that depend on an empty account.
