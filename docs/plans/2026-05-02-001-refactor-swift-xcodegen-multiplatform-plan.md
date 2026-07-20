---
title: "refactor: Convert SPM package to XcodeGen multi-platform Xcode project"
type: refactor
status: active
date: 2026-05-02
---

# refactor: Convert SPM package to XcodeGen multi-platform Xcode project

## Summary

Replace the bare Swift Package Manager project at `apps/macos/` with a proper XcodeGen-based Xcode project at `apps/swift/`. The new project defines two native targets — iOS (matching the existing Expo bundle ID) and macOS (new) — that compile the same shared SwiftUI source tree. This is the foundation for shipping on the Mac App Store and eventually replacing Expo for iOS, with Universal Purchase linking the two listings.

---

## Problem Frame

The current `apps/macos/` is an SPM `executableTarget`. It builds locally but produces a bare binary — not a proper `.app` bundle — and cannot be signed, sandboxed, or submitted to any App Store. Converting to a real Xcode project unlocks App Store distribution, code signing, entitlements, app icons, and proper `Info.plist` configuration.

---

## Requirements

- R1. The project must produce a properly signed `.app` bundle for macOS and iOS, submittable to their respective App Stores.
- R2. Both targets compile the same `Sources/PackRat/` source tree; platform differences are handled by existing `#if os(...)` guards.
- R3. The bundle ID for iOS must match the published Expo app (`com.andrewbierman.packrat`) so it can eventually replace it on the same App Store listing.
- R4. The macOS bundle ID must be `com.andrewbierman.packrat.mac`, linked to iOS via Universal Purchase in App Store Connect.
- R5. The `swift-openapi-generator` build plugin pipeline must continue to work — `PackRatAPIClient` stays as a local SPM package referenced by both Xcode targets.
- R6. The `.xcodeproj` must be gitignored and regenerated from `project.yml` via `xcodegen generate`.
- R7. The Keychain service identifier must be updated from `com.packrat.app` to `com.andrewbierman.packrat` for consistency.
- R8. macOS target must be sandboxed (required for Mac App Store) with outbound network access permitted.

---

## Scope Boundaries

- Universal Purchase linkage in App Store Connect is not part of this plan — it is a one-time manual step done after both apps are in App Store Connect.
- Keychain Access Group sharing between iOS and macOS (SSO across platforms) is deferred — it requires a provisioning profile with the shared group capability.
- App icons, launch screens, and marketing assets are not included — placeholders are created so the project compiles.
- Deep linking / URL scheme registration for OAuth on iOS (`CFBundleURLTypes`) is noted in U4 but not wired to any auth flow change.
- Replacing Expo for iOS production is out of scope — this plan only creates the Xcode project infrastructure.

### Deferred to Follow-Up Work

- Keychain Access Group for cross-platform SSO: separate PR after provisioning profiles are set up.
- App icons and proper `Assets.xcassets` content: design asset PR.
- iOS Info.plist OAuth URL scheme wiring to `AuthManager`: separate PR once the iOS target is actively used.

---

## Context & Research

### Relevant Code and Patterns

- `apps/swift/Sources/PackRat/PackRatApp.swift` — entry point, already guards macOS-only `Settings` and multi-window scenes with `#if os(macOS)`
- `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift` — already implements `phoneLayout` (TabView) for compact iOS and `splitLayout` for macOS/iPad; no changes needed
- `apps/swift/Sources/PackRat/Network/KeychainService.swift` — service string to update (U5)
- `apps/swift/Sources/PackRatAPIClient/` — local SPM target with `openapi-generator-config.yaml` and `openapi.yaml`; must remain as-is for the build plugin
- `apps/expo/app.config.ts` — source of truth for iOS bundle ID (`com.andrewbierman.packrat`), location usage strings, and URL scheme

### Institutional Learnings

- No matching solutions in `docs/solutions/` for Swift/Xcode tooling.

### External References

- XcodeGen is already installed at `/opt/homebrew/bin/xcodegen`.
- swift-openapi-generator build plugin requires `openapi.yaml` and `openapi-generator-config.yaml` to live inside the target's `path` in SPM — this is why `PackRatAPIClient` stays as a local SPM package rather than becoming an Xcode target.

---

## Key Technical Decisions

- **XcodeGen over standard `.xcodeproj`**: Avoids `.pbxproj` merge conflicts in an active monorepo; `project.yml` is human-readable and version-controlled.
- **`PackRatAPIClient` stays as local SPM package**: The `swift-openapi-generator` build plugin cannot run inside an XcodeGen-defined target directly. Keeping it as `path: "."` local package preserves the pipeline without changes.
- **Single `project.yml` for both platforms**: Both iOS and macOS targets are defined in one spec, sharing sources. This is the correct XcodeGen pattern for multi-platform apps and keeps the setup DRY.
- **Root `openapi.yaml` retained as documentation copy**: The build plugin reads from `Sources/PackRatAPIClient/openapi.yaml`. The root copy is kept for discoverability (they're identical). No symlink needed.
- **`apps/macos/` → `apps/swift/`**: `native` is ambiguous (React Native), `swiftui` is too UI-framework-specific; `swift` mirrors the convention of `apps/expo` (toolchain name).
- **Deployment targets**: iOS 17 / macOS 14 — unchanged from current `Package.swift`.
- **Keychain service string updated to `com.andrewbierman.packrat`**: Aligns with bundle ID. Breaking change for any stored tokens, acceptable since the app is not yet shipped.

---

## Open Questions

### Resolved During Planning

- **Should macOS be sandboxed?** Yes — `com.apple.security.app-sandbox` is required for Mac App Store submission.
- **Same source tree for iOS and macOS?** Yes — `AppNavigation.swift` already implements both layouts with `#if os(iOS)` guards. No restructuring needed.
- **Does the bun workspace glob pick up `apps/swift/`?** Yes — `"apps/*"` in root `package.json` matches any subdirectory; no change needed since `apps/swift/` has no `package.json`.

### Deferred to Implementation

- **Exact XcodeGen `settings:` overrides needed for App Store compliance**: Verify after first `xcodegen generate` run and Xcode opens — some build settings (e.g., `CODE_SIGN_STYLE`, `DEVELOPMENT_TEAM`) may need per-config overrides.
- **Whether `Info-iOS.plist` should be auto-generated by XcodeGen or a static file**: XcodeGen can generate it from `info.properties` in `project.yml`; a static file is also valid. Decide based on how many custom keys are needed.

---

## Output Structure

```
apps/swift/
├── project.yml                        # XcodeGen spec (checked in)
├── PackRat.xcodeproj                  # Generated, gitignored
├── Package.swift                      # Slimmed — PackRatAPIClient target only
├── openapi.yaml                       # Documentation copy (unchanged)
├── Sources/
│   ├── PackRat/                       # Shared app code (unchanged)
│   └── PackRatAPIClient/              # OpenAPI client SPM target (unchanged)
├── Resources/
│   ├── Assets.xcassets/               # AppIcon + AccentColor placeholders
│   ├── PackRat-macOS.entitlements     # App Sandbox + network.client
│   └── PackRat-iOS.entitlements       # Minimal (empty for now)
└── Tests/
    └── PackRatTests/                  # Unchanged
```

---

## Implementation Units

- U1. **Rename `apps/macos/` to `apps/swift/` and update gitignore**

**Goal:** Move the directory to its final name and ensure generated Xcode artifacts are never committed.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Rename: `apps/macos/` → `apps/swift/` (git mv)
- Modify: `.gitignore`
- Modify: `CLAUDE.md` (update `apps/macos` references)

**Approach:**
- Use `git mv apps/macos apps/swift` to preserve history.
- Add to `.gitignore`:
  - `apps/swift/PackRat.xcodeproj/`
  - `apps/swift/*.xcworkspace/xcuserdata/`
  - `apps/swift/DerivedData/`
- Update references in `CLAUDE.md` — no script references exist since the macOS app had no bun commands yet.

**Test scenarios:**
- Test expectation: none — pure filesystem rename and config change, no behavioral change.

**Verification:**
- `git status` shows `apps/swift/` tree with all prior files intact.
- `.gitignore` prevents `PackRat.xcodeproj` from appearing in `git status` after U3 runs.

---

- U2. **Slim down `Package.swift` to `PackRatAPIClient` only**

**Goal:** Remove the `PackRat` executable target and test target from `Package.swift`, keeping only the `PackRatAPIClient` SPM target that the build plugin requires. The removed targets are replaced by the Xcode project.

**Requirements:** R5

**Dependencies:** U1

**Files:**
- Modify: `apps/swift/Package.swift`

**Approach:**
- Remove the `.executableTarget(name: "PackRat", ...)` entry.
- Remove the `.testTarget(name: "PackRatTests", ...)` entry.
- Remove `Nuke` and `swift-markdown-ui` from `package.dependencies` — they move to `project.yml`.
- Keep: `swift-openapi-generator`, `swift-openapi-runtime`, `swift-openapi-urlsession`.
- Keep: `.target(name: "PackRatAPIClient", ...)` with its build plugin unchanged.
- The `platforms` array stays (`macOS(.v14)`, `iOS(.v17)`).

**Test scenarios:**
- Test expectation: none — SPM package with only `PackRatAPIClient` target; the build plugin correctness is verified as part of U7.

**Verification:**
- `swift package resolve` in `apps/swift/` completes without error.
- `swift build --target PackRatAPIClient` succeeds (build plugin generates types).

---

- U3. **Create `project.yml` (XcodeGen spec)**

**Goal:** Define the full multi-platform Xcode project — iOS and macOS targets, remote SPM dependencies, local `PackRatAPIClient` reference, entitlements, and resources.

**Requirements:** R1, R2, R3, R4, R5, R6, R8

**Dependencies:** U1, U2

**Files:**
- Create: `apps/swift/project.yml`

**Approach:**

Top-level `project.yml` structure:

```yaml
name: PackRat

options:
  bundleIdPrefix: com.andrewbierman
  deploymentTarget:
    iOS: "17.0"
    macOS: "14.0"
  xcodeVersion: "16.0"
  createIntermediateGroups: true
  groupSortPosition: top

packages:
  Nuke:
    url: https://github.com/kean/Nuke
    from: "12.0.0"
  MarkdownUI:
    url: https://github.com/gonzalezreal/swift-markdown-ui
    from: "2.4.0"
  OpenAPIRuntime:
    url: https://github.com/apple/swift-openapi-runtime
    from: "1.5.0"
  OpenAPIURLSession:
    url: https://github.com/apple/swift-openapi-urlsession
    from: "1.0.0"
  PackRat:                     # local Package.swift (PackRatAPIClient target)
    path: "."
```

Two targets (`PackRat-iOS`, `PackRat-macOS`) each with:
- `sources: Sources/PackRat`
- `resources: Resources/Assets.xcassets`
- Dependencies on all four remote packages + `PackRatAPIClient` product from the local `PackRat` package
- Respective entitlements paths
- `SWIFT_VERSION: "5.9"`
- `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` build settings

iOS target additional settings:
- `INFOPLIST_FILE` pointing at a generated or static plist with `NSLocationWhenInUseUsageDescription`, `ITSAppUsesNonExemptEncryption: false`, and `CFBundleURLTypes` for the `com.andrewbierman.packrat` URL scheme.

Test target (`PackRatTests`) as `bundle.unit-test` on iOS, depending on `PackRat-iOS`.

**Patterns to follow:**
- `apps/expo/app.config.ts` for iOS bundle ID, location usage string, and URL scheme values to mirror.

**Test scenarios:**
- Test expectation: none — validated by U7 (xcodegen generate + Xcode compile).

**Verification:**
- `xcodegen generate` in `apps/swift/` exits 0 and produces `PackRat.xcodeproj`.
- Project opens in Xcode and shows two scheme targets: `PackRat-iOS` and `PackRat-macOS`.

---

- U4. **Create `Resources/` directory with `Assets.xcassets` and entitlements**

**Goal:** Provide the supporting files referenced by `project.yml` — placeholder app icon/accent color asset catalog and entitlement property lists for each platform.

**Requirements:** R1, R8

**Dependencies:** U1

**Files:**
- Create: `apps/swift/Resources/Assets.xcassets/Contents.json`
- Create: `apps/swift/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json` (empty set placeholder)
- Create: `apps/swift/Resources/Assets.xcassets/AccentColor.colorset/Contents.json`
- Create: `apps/swift/Resources/PackRat-macOS.entitlements`
- Create: `apps/swift/Resources/PackRat-iOS.entitlements`

**Approach:**

`PackRat-macOS.entitlements`:
```xml
com.apple.security.app-sandbox → true
com.apple.security.network.client → true
```

`PackRat-iOS.entitlements`: empty `<dict/>` for now (no special capabilities needed at this stage).

`Assets.xcassets` needs valid `Contents.json` files so Xcode doesn't error. `AppIcon.appiconset` uses an empty image set (no actual images yet — a follow-up design PR will add real icons).

**Test scenarios:**
- Test expectation: none — static resource files; correctness verified by Xcode compiling without asset errors in U7.

**Verification:**
- `PackRat-macOS.entitlements` contains the sandbox and network keys.
- Xcode does not show asset catalog errors when the project is opened.

---

- U5. **Update `KeychainService` bundle identifier string**

**Goal:** Align the Keychain service string with the actual app bundle ID.

**Requirements:** R7

**Dependencies:** U1

**Files:**
- Modify: `apps/swift/Sources/PackRat/Network/KeychainService.swift`

**Approach:**
- Change `private let service = "com.packrat.app"` → `"com.andrewbierman.packrat"`.
- No other changes to the file — the read/write logic is correct as-is.
- This is a breaking change for any locally cached tokens; users will need to log in again after the app update. Acceptable since the app has not shipped yet.

**Test scenarios:**
- Test expectation: none — single string constant change in an unshipped app; no existing tokens to migrate.

**Verification:**
- `grep -r "com.packrat.app" apps/swift/` returns no results.

---

- U6. **Add `bun swift` script and update `CLAUDE.md`**

**Goal:** Give developers a single bun command to regenerate the Xcode project and update project documentation.

**Requirements:** R6

**Dependencies:** U1, U3

**Files:**
- Modify: `package.json` (root)
- Modify: `CLAUDE.md`

**Approach:**
- Add to root `package.json` scripts:
  ```json
  "swift": "cd apps/swift && xcodegen generate"
  ```
- Update `CLAUDE.md`:
  - Rename `apps/expo` → keep (iOS/Android)
  - Add `apps/swift` row to the workspace table: `Swift/SwiftUI 5.9 / Xcode 16 / XcodeGen` for native iOS + macOS
  - Add `bun swift` to the Commands section: regenerates `PackRat.xcodeproj` from `project.yml`
  - Remove any reference to `apps/macos`

**Test scenarios:**
- Test expectation: none — script registration and doc update.

**Verification:**
- `bun swift` runs from repo root and exits 0.
- `CLAUDE.md` references `apps/swift` and `bun swift`.

---

- U7. **Generate project and verify dual-platform compile**

**Goal:** Run `xcodegen generate`, open the project in Xcode, resolve packages, and confirm both targets compile cleanly.

**Requirements:** R1, R2, R5

**Dependencies:** U2, U3, U4, U5

**Files:**
- No source changes — this is a validation unit.

**Approach:**
- Run `cd apps/swift && xcodegen generate`.
- Open `PackRat.xcodeproj` in Xcode.
- In Signing & Capabilities, set the Development Team for both targets (one-time manual step — the team ID is not committed).
- Select `PackRat-macOS` scheme → build for My Mac → verify 0 errors.
- Select `PackRat-iOS` scheme → build for any iOS simulator → verify 0 errors.
- Confirm `PackRatAPIClient` OpenAPI types are generated (check the derived data `GeneratedSources` folder).

**Test scenarios:**
- Happy path: both `PackRat-macOS` and `PackRat-iOS` targets compile with 0 errors and 0 warnings on a clean build.
- Edge case: `PackRatAPIClient` build plugin fires — `openapi.yaml` is parsed and client types are available in `Sources/PackRat/` via `import PackRatAPIClient`.
- Error path: if any `#if os(macOS)`-guarded type is unavailable on iOS, address with an additional `#if` or by moving the symbol to a platform-specific file.

**Verification:**
- Both schemes build green.
- App launches on macOS simulator / device showing the auth gate.
- App launches on iOS simulator showing the auth gate.

---

## System-Wide Impact

- **Interaction graph:** No runtime behavior changes. `KeychainService` token reads return nil for existing installs (service string changed), prompting re-login — expected since app is pre-release.
- **Error propagation:** Unchanged — all network, persistence, and auth error paths remain the same.
- **State lifecycle risks:** None — SwiftData container name (`"PackRat"`) is unchanged; existing local caches remain valid.
- **API surface parity:** `PackRatAPIClient` generated types are unchanged — same `openapi.yaml`, same build plugin invocation.
- **Integration coverage:** The swift-openapi build plugin is the key integration to verify — confirmed via U7.
- **Unchanged invariants:** All Swift source files in `Sources/PackRat/` are unchanged in content. No refactoring of app code.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `swift-openapi-generator` build plugin may not fire for a local SPM package referenced from XcodeGen | Verified at U7; if it fails, move `openapi.yaml` processing to a pre-build script phase in `project.yml` |
| XcodeGen version drift (installed globally vs. needed version) | xcodegen is at `/opt/homebrew/bin/xcodegen`; pin the version in CLAUDE.md if issues arise |
| SwiftData or `@Observable` on iOS 17 simulator may reveal macOS-only API usage hidden by `#if os(macOS)` guards | Caught at U7 build step; fix with additional guards or move code to platform-specific files |
| Duplicate symbol errors if both targets compile the same files without separate compilation contexts | XcodeGen correctly creates independent targets sharing the source folder — not a duplicate symbol issue |
| iOS `Info.plist` missing privacy strings causes App Store rejection | `NSLocationWhenInUseUsageDescription` must be present; carried from Expo `app.config.ts` into U3 |

---

## Sources & References

- Related code: `apps/swift/Package.swift`, `apps/swift/Sources/PackRat/PackRatApp.swift`, `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift`
- Bundle ID source: `apps/expo/app.config.ts` → `getBundleIdentifier()` → `com.andrewbierman.packrat`
- XcodeGen docs: https://github.com/yonaskolb/XcodeGen
- swift-openapi-generator: https://github.com/apple/swift-openapi-generator
