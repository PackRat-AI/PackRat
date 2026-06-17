# Feature parity matrix — SwiftUI vs Expo (2026-05-20)

Maps every feature surface across both clients at the end of the SwiftUI ship-readiness audit. Each row is a user-visible capability or a platform-level concern. Status meanings:

- **parity** — both apps deliver the capability; UX may differ idiomatically (this is intentional per "native Swift over Expo-mimic" framing)
- **swift-only** — present in `apps/swift/` and not in `apps/expo/`
- **expo-only** — present in `apps/expo/` and not in `apps/swift/`
- **stubbed** — Swift side has the foundation but a deferred real implementation (e.g., `offline-ai` MLX wire-up)
- **gap** — missing from Swift, blocks shipping
- **n/a** — does not apply on the surface

Use **swap blocker?** to score "if we retired Expo iOS today, would users regress?".

## Top-level feature surface

| Feature | Expo path | Swift path | Status | Swap blocker? | Notes |
|---|---|---|---|---|---|
| Auth (sign-in / sign-up / sign-out) | `apps/expo/features/auth/` | `Sources/PackRat/Features/Auth/` | parity | no | Migrated to Better Auth; Swift uses Bearer token via `set-auth-token` response header. `verify-email` flow removed (Better Auth `requireEmailVerification: false`). |
| Packs (list / create / edit / delete / detail) | `apps/expo/features/packs/` | `Sources/PackRat/Features/Packs/` | parity | no | NavigationSplitView detail column on macOS; right-click context menu replaces iOS long-press / swipe-to-delete |
| Trips | `apps/expo/features/trips/` | `Sources/PackRat/Features/Trips/` | parity | no | macOS uses dedicated `WindowGroup` for trip detail (window-per-trip UX matches Mac idiom) |
| Pack Templates | `apps/expo/features/pack-templates/` | `Sources/PackRat/Features/PackTemplates/` | parity | no | |
| Catalog (browse / search) | `apps/expo/features/catalog/` | `Sources/PackRat/Features/Catalog/` | parity | no | |
| Weather (forecast / location search / alerts) | `apps/expo/features/weather/` | `Sources/PackRat/Features/Weather/` | parity | no | Alert preferences sub-screen ported |
| Trail Conditions | `apps/expo/features/trail-conditions/` | `Sources/PackRat/Features/TrailConditions/` | parity | no | macOS `Picker` renders as popUpButton + NSMenuItems |
| Guides | `apps/expo/features/guides/` | `Sources/PackRat/Features/Guides/` | parity | no | |
| Feed (social posts / composer) | `apps/expo/features/feed/` | `Sources/PackRat/Features/Feed/` | parity | no | |
| Wildlife ID | `apps/expo/features/wildlife/` | `Sources/PackRat/Features/Wildlife/` | parity | no | |
| Profile | `apps/expo/features/profile/` | `Sources/PackRat/Features/Profile/` | parity | no | |
| **AI Chat (Assistant)** | `apps/expo/features/ai/` | `Sources/PackRat/Features/Chat/` | parity | no | Streaming responses + tool-call visibility on both |
| **AI Packs** (generative pack suggestions) | `apps/expo/features/ai-packs/` | `Sources/PackRat/Features/AIPacks/` | **parity (new this audit)** | no | Ported in this PR. SwiftUI uses `.confirmationDialog` + `.sheet` + bounded `Stepper`. Admin-gated entry. |
| **Offline AI** (on-device LLM) | `apps/expo/features/offline-ai/` (llama.rn) | `Sources/PackRat/Features/OfflineAI/` | **stubbed (new this audit)** | conditional — see below | Mock provider works; MLX wire-up deferred. Runbook in audit doc. Behind `#if DEBUG` + `useRealLocalLLM` feature flag (default false). |
| Gear Inventory | — | `Sources/PackRat/Features/GearInventory/` | swift-only | no | Bonus on Swift side |
| Preferences (settings) | — | `Sources/PackRat/Features/Preferences/` | swift-only | no | macOS native Settings scene; iOS shows as a tab |
| Search (global) | — | `Sources/PackRat/Features/Search/` | swift-only | no | |
| Season Suggestions | — | `Sources/PackRat/Features/SeasonSuggestions/` | swift-only | no | |
| Shopping List | — | `Sources/PackRat/Features/Shopping/` | swift-only | no | |

## Platform / infrastructure dimensions

| Dimension | Expo iOS | Swift iOS | Swift macOS | Status | Notes |
|---|---|---|---|---|---|
| Authentication mechanism | Better Auth (`@better-auth/expo`) | Better Auth (hand-rolled REST + Bearer plugin) | Better Auth (same code) | parity | Token via Keychain on both Swift platforms |
| Persistence | AsyncStorage + React Query cache | SwiftData (`CachedPack`, `CachedTrip`, `ShoppingItem`) | SwiftData (same code) | parity (different mechanisms, equivalent intent) | Native ORM on Swift; better cold-start |
| Telemetry (Sentry) | wired (`@sentry/react-native`) | wired (sentry-cocoa via SPM) | wired (same code) | parity | DSN flows xcconfig → Info.plist → SentryConfig.start |
| Deep linking — `packrat://` scheme | wired | wired (`Sources/PackRat/Navigation/DeepLink.swift` parser) | not wired | parity (iOS); macOS gap (low priority) | Per-destination routing deferred on both |
| Universal links (HTTPS) | not configured | not configured | not configured | deferred for all | Gated on custom-domain decision; explicitly out of audit scope |
| Push notifications | not implemented | not implemented | not implemented | n/a | Greenfield on both apps |
| Feature flags | `@packrat/config` re-export | `Defaults.Keys.useRealLocalLLM` exists; broader parity scaffolding deferred | same | partial | U11 deliberately not expanded — only the offline-ai flag landed. Full parity = follow-up. |
| OpenAPI client | runtime-generated by Elysia | hand-curated YAML + swift-openapi-generator | same | gap (audit-known) | Generated `Client.swift` / `Types.swift` reference deleted `/api/auth/*` routes; compiles namespaced. U7 architecturally deferred. |

## Test coverage

| Surface | Expo | Swift iOS | Swift macOS |
|---|---|---|---|
| Unit tests (services, models, helpers) | vitest, partial | Swift Testing — `ModelTests` + `NetworkTests` + `ServiceTests` + `ViewModelTests` + `AIPacksTests` (11) + `OfflineAITests` (19) + `DeepLinkTests` (8) + `SentryConfigTests` (7) + `FeatureFlagsTests` (deferred — U11) | shared with iOS via `PackRatMacOSTests` bundle |
| UI tests | Playwright (`apps/expo/playwright/`) for web, Maestro for native | XCUITest — 15 test classes, 74 cases (Auth, Catalog, Chat, Feed, MoreTabs, Nav, Pack, PackSubFlow, PackTemplate, SeasonSuggestions, TrailCondition, Trip, Weather, WeatherSubFlow) | XCUITest — **13 new MacOS test classes, 1492 lines** (this audit) targeting sidebar navigation |
| E2E runner | `bash .github/scripts/e2e.sh ios` (Maestro) | `bun e2e:swift [--plan smoke|full]` | `bun e2e:swift:macos [--plan smoke|full]` |
| CI workflow | `.github/workflows/e2e-tests.yml` | `.github/workflows/swift-ci.yml` (new this audit) | same (matrix) |

## Distribution / signing

| Concern | Expo iOS | Swift iOS | Swift macOS | Status |
|---|---|---|---|---|
| Build profiles | EAS Build (development / preview / e2e / production) | XcodeGen → Xcode archive | XcodeGen → Xcode archive | parity |
| App Store distribution | EAS Submit | TestFlight (manual) | Mac App Store OR notarized DMG (decision deferred) | conditional |
| Signing certificate | Apple Developer (team `7WV9JYCW55`) | provisioned | **MISSING — Mac Development cert** | swap blocker for macOS test runs + distribution |
| Notarization | n/a | n/a | required for non–Mac App Store distribution | deferred |

## Status totals

- **parity (full)**: 11 user-facing features + 3 infrastructure dimensions = 14
- **swift-only bonuses**: 5 (Gear Inventory, Preferences, Search, Season Suggestions, Shopping)
- **expo-only gaps**: 0 user-facing (ai-packs ported this audit; offline-ai foundation stubbed but functional)
- **stubbed**: 1 (offline-ai — real MLX deferred)
- **swap blockers**: 1 platform issue (Mac dev cert), 0 user-facing
