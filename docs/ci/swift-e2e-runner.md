# Swift E2E Runner

This repo has two iOS-era app stacks for now:

- Expo app: production iOS app, covered by Maestro in `.github/workflows/e2e-tests.yml`.
- Swift app: native macOS app first, with exploratory Swift iOS coverage, covered by XCTest/XCUITest in `.github/workflows/swift-e2e.yml`.

Do not move the Swift app to Maestro. XCUITest is the native Apple UI automation layer and gives better result bundles, accessibility hierarchy data, simulator integration, and macOS app coverage.

## GitHub Runner

The full macOS Swift UI suite should run on a persistent self-hosted Mac runner. GitHub-hosted macOS runners are fine for iOS simulator work, but desktop macOS app automation depends on machine-level state.

Required labels:

```text
self-hosted
macOS
packrat-e2e
```

The label `packrat-e2e` is registered in `.github/actionlint.yaml` so workflow linting accepts the custom runner.

## Machine Setup

Install and select the expected Xcode version:

```sh
sudo xcode-select -s /Applications/Xcode-26.2.0.app/Contents/Developer
xcodebuild -version
```

Enable Automation Mode without per-run prompts:

```sh
sudo automationmodetool enable-automationmode-without-authentication
automationmodetool status
```

The status may still show Automation Mode disabled until a process enables it, but it must say the device does not require user authentication to enable Automation Mode.

Keep the runner attached to a logged-in GUI session. macOS UI tests are less reliable from a headless or locked desktop session because Accessibility and event synthesis depend on the user session.

Run macOS UI tests under `caffeinate` so long cold builds do not let the display or user session idle before XCTest activates the app:

```sh
caffeinate -dimsu bun run e2e:swift:mac-smoke
caffeinate -dimsu bun run e2e:swift:mac-ui
```

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

- Run `bun run e2e:swift:mac-smoke` on the self-hosted Mac runner.
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
