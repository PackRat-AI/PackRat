# Swift app — deep linking parity audit (U10)

Tracks where Swift's URL-scheme handling stands relative to the existing Expo iOS app, and what remains deferred.

## Current state after U10

- **Primary deep-link scheme**: `packrat://` — matches Expo's `scheme: 'packrat'` in `apps/expo/app.config.ts`. Existing universal links / shared `packrat://...` URLs survive an iOS-to-Swift swap.
- **OAuth callback scheme**: `com.andrewbierman.packrat://` — retained. Google Sign-In and other OAuth providers register their callback under the bundle identifier; the legacy scheme stays in `CFBundleURLTypes` alongside `packrat`.
- **Handler**: `AuthGateView` is the root mounted view across the auth gate and the post-login app, so the `.onOpenURL` modifier is attached there. URLs flow through `DeepLink.parse(_:)` which returns one of:
  - `.home` — for `packrat://`, `packrat://home`
  - `.pack(id:)` — for `packrat://pack/<id>`
  - `.trip(id:)` — for `packrat://trip/<id>`
  - `.feed`, `.weather`
  - `.unknown(URL)` — everything else
- **Routing**: deferred. The parsed link is currently logged. Each destination needs a route binding (e.g., wire `NavItem` selection + push to detail) — that is product-routing work, not parity-scheme work, and is scoped out of U10.
- **macOS**: scheme handling is iOS-only for now. `Info-macOS.plist` has no `CFBundleURLTypes`. macOS apps can register URL handlers via the same plist key, but the Mac use case for `packrat://pack/<id>` is less obvious; deferred until product signal.

## Tests

`apps/swift/Tests/PackRatTests/DeepLinkTests.swift` covers:

- happy-path destinations (`pack`, `trip`, `feed`, `weather`, `home`)
- missing IDs (`packrat://pack` → unknown)
- wrong scheme (`https://...` → unknown)
- legacy reverse-DNS scheme `com.andrewbierman.packrat://` returns `.unknown` — `DeepLink.parse` is only responsible for `packrat://`, OAuth callbacks are handled by their respective SDKs

## Deferred — universal links

Universal links (HTTPS URLs that open the app) are explicitly deferred per the plan's `### Deferred for later` boundary. To wire them, three things must align:

1. `apple-app-site-association` JSON hosted at `https://<canonical-host>/.well-known/apple-app-site-association` with the app's team ID + bundle ID. The canonical host is **TBD** because `api.packrat.app` is NXDOMAIN today (see baseline doc) and the live API runs on `packrat-api.orange-frost-d665.workers.dev`. A custom-domain decision is a prerequisite.
2. `com.apple.developer.associated-domains` entitlement on both `PackRat-iOS` and `PackRat-macOS` targets — `Resources/PackRat-iOS.entitlements` and `PackRat-macOS.entitlements` are empty/sandbox today.
3. App ID configuration in Apple Developer with the Associated Domains capability enabled — an account-state change explicitly out of audit scope per R10.

Until the canonical-host decision lands, custom-scheme `packrat://` is the only deep-link surface. That's matched to Expo today, so retiring Expo iOS does not regress.

## Routing — follow-up scope

The unimplemented routing per `DeepLink` case is enumerated here so the decision artifact (U13) can size it:

| Link | Destination | Implementation sketch |
|---|---|---|
| `.home` | Dashboard / home tab | Trivial — focus `NavItem.home`. |
| `.pack(id:)` | Pack detail | Open `PackDetailView` for the cached pack; trigger fetch if not cached. |
| `.trip(id:)` | Trip detail | Same shape as Pack — load `CachedTrip` or fetch. |
| `.feed` | Feed tab | Focus `NavItem.feed`. |
| `.weather` | Weather tab | Focus `NavItem.weather`. |

Each is ≤30 min of work but routes through navigation state that doesn't exist yet (no `selectedNavItem` binding visible on `AppNavigation`). Best landed alongside or after the navigation refactor for the macOS sidebar.
