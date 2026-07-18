# PackRat Swift Testing

The generated Xcode project is not committed. Regenerate it after changing
`project.yml`:

```sh
bun swift
```

If Xcode or SwiftPM reports a temporary-directory error on this machine, ensure
the configured temp directory exists:

```sh
mkdir -p /Volumes/CrucialX10/tmp/andrewbierman
```

## Commands

```sh
bun run test:swift:runner
bun run test:swift:unit
bun run e2e:swift:ios-sanity
bun run e2e:swift:ios-smoke
bun run e2e:swift:ios
bun run e2e:swift:mac
bun run e2e:swift:mac-smoke
bun run e2e:swift:mac-ui
```

`e2e:swift` defaults to iOS UI tests for compatibility with the original
runner. All Xcode result bundles are written under `apps/swift/TestResults/`.

Sanity mode is the fastest TestFlight-style loading check:

- `e2e:swift:ios-sanity`: iOS launch, guest entry, real login, and primary tabs.

Smoke modes are intentionally small PR gates:

- `e2e:swift:mac-smoke`: macOS login, sidebar navigation, and pack create/add-item.
- `e2e:swift:ios-smoke`: iOS auth, guest persistence, feature gating, navigation,
  search/filter/explore entry points, and weather entry.

Full modes are the platform confidence gates:

- `e2e:swift:mac-ui`: full native macOS app UI suite.
- `e2e:swift:ios`: exploratory native Swift iOS app UI suite. This is separate
  from the existing Expo iOS app, which remains covered by Maestro.

UI modes require credentials in the process environment or `.env.local`:

```sh
E2E_EMAIL=...
E2E_PASSWORD=...
```

The runner also accepts `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`, then forwards
them to XCTest as `E2E_EMAIL` and `E2E_PASSWORD`. Credential values are not
printed by the runner.

Set `E2E_API_BASE_URL` to point UI tests at a specific API worker without
changing the app's saved preferences:

```sh
E2E_API_BASE_URL=http://localhost:8788
```

## CI

Swift E2E CI is defined in `.github/workflows/swift-e2e.yml`.

- Pull requests run the macOS smoke subset on a self-hosted Mac runner.
- Pushes, scheduled runs, and manual macOS runs execute the full macOS suite.
- Swift iOS runs nightly or manually and is labeled exploratory while the Expo
  app remains the production iOS app.
- Each CI run uploads `.xcresult` bundles, screenshots, failure triage artifacts,
  and a GitHub step summary generated with `xcresulttool`.

See `docs/ci/swift-e2e-runner.md` for self-hosted Mac runner setup.

## TestFlight Lanes

The Swift iOS app has two TestFlight identities:

- Replacement beta: `com.andrewbierman.packrat`, display name `PackRat`. This is
  the existing Expo/App Store listing and is the only lane that can validate a
  seamless update for existing testers. Its embedded watchOS companion uses
  `com.andrewbierman.packrat.watchkitapp`.
- Side-by-side beta: `com.andrewbierman.packrat.swift`, display name
  `PackRat Swift`. This is useful for parallel Swift QA, but iOS treats it as a
  separate app with separate install, keychain, and app container state. Its
  embedded watchOS companion uses `com.andrewbierman.packrat.swift.watchkitapp`.

Upload commands require an explicit lane so we do not accidentally test the
wrong App Store Connect record:

```sh
APP_STORE_CURRENT_BUILD_NUMBER=2026071801 BUILD_NUMBER=2026071802 \
  bun swift:testflight:preflight --replacement --production
bun apps/swift/scripts/upload-testflight.ts --replacement --dry-run
bun apps/swift/scripts/upload-testflight.ts --replacement
bun apps/swift/scripts/upload-testflight.ts --side-by-side --staging
```

`--staging` uses the Staging build config (`PACKRAT_ENV=dev`). Without it, the
script archives Release (`PACKRAT_ENV=production`).

Use `--dry-run` before a real upload to verify the lane, bundle id, display
name, build configuration, API environment, and Xcode archive overrides without
requiring Apple credentials or running Xcode.

Use `swift:testflight:preflight` before the replacement upload when validating a
seamless update. It fails unless the resolved archive is the existing Expo
listing (`com.andrewbierman.packrat`, `PackRat`), Release/production, and, when
`APP_STORE_CURRENT_BUILD_NUMBER` is supplied, has a strictly greater build
number than the latest App Store Connect build.

The same check is available from the manual **Swift E2E Tests** GitHub workflow:
enable `run_testflight_preflight`, then provide `replacement_build_number` and
`current_app_store_build_number`. That verifies the replacement metadata without
archiving or uploading.

## Data Isolation

Swift E2E tests use unique names for records they create. That keeps repeated
runs safe against shared account state, but it does not fully clean historical
test data from the backend. If the shared E2E account starts accumulating enough
data to affect performance or assertions, add API-backed cleanup helpers or a
test-only reset endpoint and call it from the runner before/after UI modes.

## Signing

`e2e:swift:mac` passes `CODE_SIGNING_ALLOWED=NO` so the local compile gate can
run without provisioning.

`e2e:swift:mac-ui` must still be signed because XCTest launches a runner app,
but the runner uses Xcode's local ad-hoc identity (`Sign to Run Locally`) so
smoke tests do not block on private-key prompts.

Normal signed builds use automatic signing with team `666HGMV2LU`. If command-
line signing fails with `errSecInternalComponent`, the certificate is installed
but `codesign` cannot access the private key from the login keychain. Unlock the
keychain and allow Apple tooling to use the key before rerunning:

```sh
security unlock-keychain ~/Library/Keychains/login.keychain-db
security set-key-partition-list -S apple-tool:,apple: -s ~/Library/Keychains/login.keychain-db
```

## Worktree Hygiene

The Swift branch is active and may move while multiple agents are working.
Fetch before editing shared Swift files, then compare against
`origin/claude/swift-mac-app-effort-tTGd7` before final verification.
