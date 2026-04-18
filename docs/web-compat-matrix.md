# PackRat Web Mode — Compatibility Matrix

This document tracks every native-only dependency in `apps/expo` and its web status.
Update this table as platform adapters are added.

---

## Legend

| Status | Meaning |
|---|---|
| ✅ Done | Platform adapter created; web build will use the web variant |
| 🔶 Partial | Module has limited web support or a stub; some features degraded |
| ❌ Blocked | No web support; screens/features that import this will not work on web |
| ℹ️ N/A | Module already works on web (Expo provides stubs, or it's pure JS) |

---

## Storage & Persistence

| Module | Files | Status | Notes |
|---|---|---|---|
| `expo-sqlite/kv-store` | `atoms/atomWithKvStorage`, `lib/api/client`, `features/auth/atoms/authAtoms`, `features/auth/store/user`, `features/auth/hooks/*`, all Legend State stores | ✅ Done | `.web.ts` adapters use `localStorage` |
| `expo-secure-store` | `atoms/atomWithSecureStorage` | ✅ Done | `.web.ts` adapter uses `localStorage` (not cryptographically secure — acceptable for MVP) |
| `@legendapp/state/persist-plugins/expo-sqlite` (`observablePersistSqlite`) | All store files | ✅ Done | Web stores omit the `persist` block; data is API-only (no offline cache on web) |
| `@react-native-async-storage/async-storage` | `features/auth/hooks/useAuthActions`, `useAuthInit` | ✅ Done | `.web.ts` adapters use `localStorage` |

---

## Authentication

| Module | Files | Status | Notes |
|---|---|---|---|
| `@react-native-google-signin/google-signin` | `features/auth/hooks/useAuthActions`, `useAuthInit` | 🔶 Partial | Web adapter throws a friendly error; OAuth redirect flow to be implemented |
| `expo-apple-authentication` | `features/auth/hooks/useAuthActions` | ❌ Blocked | Apple Sign-In is iOS-only; not planned for web |
| Email / password auth | `features/auth/hooks/useAuthActions` | ✅ Done | Works on both platforms |

---

## Device APIs

| Module | Files | Status | Notes |
|---|---|---|---|
| `expo-navigation-bar` | `lib/hooks/useColorScheme` | ✅ Done | `.web.tsx` adapter is a no-op |
| `expo-haptics` | `app/(app)/messages/conversations`, `features/ai/components/ChatBubble` | ℹ️ N/A | Expo provides a silent web stub |
| `expo-clipboard` | `features/ai/components/ChatBubble` | ℹ️ N/A | Expo provides partial web support via Clipboard API |
| `expo-store-review` | (future feature) | ℹ️ N/A | Expo provides a no-op web stub |
| `expo-updates` | `features/auth/hooks/useAuthActions` | ✅ Done | `.web.ts` adapter uses `window.location.reload()` |
| `expo-glass-effect` | Layout/blur components | ℹ️ N/A | Falls back gracefully on web (CSS `backdrop-filter`) |

---

## Camera, Media & File System

| Module | Files | Status | Notes |
|---|---|---|---|
| `expo-file-system/legacy` | `lib/constants`, `lib/utils/ImageCacheManager`, `features/packs/utils/uploadImage`, `app/(app)/(tabs)/profile/index`, `features/catalog/lib/cacheCatalogItemImage` | ✅ Done (utilities) / 🔶 Partial (screens) | `.web.ts` stubs created for utilities; profile/catalog screens still import directly — needs per-screen web UI |
| `expo-image-picker` | `features/packs/hooks/useImagePicker`, `features/feed/screens/CreatePostScreen` | 🔶 Partial | Expo's web stub uses `<input type="file">`; works but UX differs from native gallery |
| `expo-web-browser` | Auth flow | ℹ️ N/A | Already uses web APIs on web |

---

## Maps & Location

| Module | Files | Status | Notes |
|---|---|---|---|
| `react-native-maps` | `app/(app)/trip/location-search`, `features/trips/screens/TripDetailScreen` | 🔶 Partial | Metro web stub renders `null`; replace with a web map library (e.g. Leaflet, Mapbox) for full web support |
| `expo-location` | `features/weather/screens/LocationSearchScreen` | ❌ Blocked | Needs migration to `navigator.geolocation` API on web |

---

## AI / On-device ML

| Module | Files | Status | Notes |
|---|---|---|---|
| `llama.rn` | `features/ai/lib/localModelManager`, `features/offline-ai/*` | 🔶 Partial | Metro web stub throws on use; on-device inference is mobile-only; cloud AI still works |

---

## UI / Navigation

| Module | Files | Status | Notes |
|---|---|---|---|
| `react-native-keyboard-controller` | `app/auth/**`, `app/(app)/messages/**`, `app/(app)/ai-chat`, `app/(app)/(tabs)/profile/**`, feature forms | ℹ️ N/A | v1.18+ has partial web support; `KeyboardAwareScrollView` degrades gracefully |
| `@gorhom/bottom-sheet` | Providers, AI sheet, Pack actions, etc. | ℹ️ N/A | v5 has web support; kept in native providers but removed from `providers/index.web.tsx` |
| `react-native-ios-context-menu` | Context menu components | 🔶 Partial | Metro web stub renders children directly |
| `react-native-ios-utilities` | Supporting utilities | 🔶 Partial | Metro web stub is a no-op |
| `@expo/react-native-action-sheet` | `Providers` | ℹ️ N/A | Has web support |

---

## Platform Adapters Created

All adapters follow Metro's platform extension resolution:
> Metro automatically resolves `foo.web.ts` over `foo.ts` when building for web.

| Adapter File | Replaces |
|---|---|
| `atoms/atomWithKvStorage.web.ts` | `atoms/atomWithKvStorage.ts` |
| `atoms/atomWithSecureStorage.web.ts` | `atoms/atomWithSecureStorage.ts` |
| `features/auth/atoms/authAtoms.web.ts` | `features/auth/atoms/authAtoms.ts` |
| `features/auth/hooks/useAuthActions.web.ts` | `features/auth/hooks/useAuthActions.ts` |
| `features/auth/hooks/useAuthInit.web.ts` | `features/auth/hooks/useAuthInit.ts` |
| `features/auth/store/user.web.ts` | `features/auth/store/user.ts` |
| `features/pack-templates/store/packTemplateItems.web.ts` | `...packTemplateItems.ts` |
| `features/pack-templates/store/packTemplates.web.ts` | `...packTemplates.ts` |
| `features/packs/store/packItems.web.ts` | `...packItems.ts` |
| `features/packs/store/packingMode.web.ts` | `...packingMode.ts` |
| `features/packs/store/packs.web.ts` | `...packs.ts` |
| `features/packs/store/packWeightHistory.web.ts` | `...packWeightHistory.ts` |
| `features/packs/utils/uploadImage.web.ts` | `...uploadImage.ts` |
| `features/trail-conditions/store/trailConditionReports.web.ts` | `...trailConditionReports.ts` |
| `features/trips/store/trips.web.ts` | `...trips.ts` |
| `lib/api/client.web.ts` | `lib/api/client.ts` |
| `lib/constants.web.ts` | `lib/constants.ts` |
| `lib/hooks/useColorScheme.web.tsx` | `lib/hooks/useColorScheme.tsx` |
| `lib/utils/ImageCacheManager.web.ts` | `lib/utils/ImageCacheManager.ts` |
| `providers/index.web.tsx` | `providers/index.tsx` |
| `app/_layout.web.tsx` | `app/_layout.tsx` |

---

## Metro Web Stubs

Located in `apps/expo/web-stubs/` — resolved by `metro.config.js` `resolveRequest` for `platform === 'web'`.

| Stub | Module |
|---|---|
| `web-stubs/react-native-maps.js` | `react-native-maps` |
| `web-stubs/llama.rn.js` | `llama.rn` |
| `web-stubs/react-native-ios-context-menu.js` | `react-native-ios-context-menu` |
| `web-stubs/react-native-ios-utilities.js` | `react-native-ios-utilities` |

---

## MVP Feature Set (Web Phase 1)

Features ready to use on web without further work:

- ✅ Email/password authentication (sign in, sign up, forgot/reset password, email verification)
- ✅ Pack list & CRUD (no local cache, API-backed)
- ✅ Pack item CRUD (text/weight data only; image upload uses browser file picker)
- ✅ Trip list & CRUD (no map picker — location must be entered as text)
- ✅ Pack templates list & CRUD
- ✅ AI chat (cloud AI; on-device AI not available)
- ✅ Catalog browsing
- ✅ Weight analysis, pack stats, seasonal suggestions
- ✅ Guides viewer
- ✅ Settings

Features that need additional work before web:

- 🔶 Map-based location picker (needs Leaflet/Mapbox integration)
- 🔶 Weather with geolocation (needs `navigator.geolocation` wrapper)
- 🔶 Google OAuth (needs OAuth redirect flow)
- 🔶 Profile photo upload (needs `<input type="file">` integration in profile screen)
- ❌ On-device AI (llama.rn — mobile only by design)
- ❌ Apple Sign-In (iOS only)

---

## Architecture Notes

- **Shared business logic**: All API query hooks, types, validation schemas, and utility functions are platform-agnostic and work on both web and native.
- **No shared UI**: Per the project decision, mobile uses NativeWind/NativeWindUI; web uses shadcn components (Radix UI + Tailwind). The `packages/web-ui` package contains all shadcn components already.
- **Offline support**: Not available on web. The web build is always online-first; Legend State stores have no SQLite persistence layer.
- **Future**: Consider extracting shared query hooks and types into `packages/shared` so they can be imported by both `apps/expo` and future web apps.
