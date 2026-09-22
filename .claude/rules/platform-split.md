---
paths:
  - "apps/expo/**"
  - "apps/swift/**"
---

# Mobile is split by platform

| Platform | Codebase | Validate on |
|---|---|---|
| iOS, watchOS, macOS | `apps/swift` (SwiftUI) | Apple simulator or device |
| Android | `apps/expo` (React Native) | Android emulator or device |

**iOS is not shipped from Expo.** The Expo iOS target still builds but no store
build comes from it, so a change in `apps/expo` is validated on Android and a
change in `apps/swift` is validated on an Apple device.

Launching an iOS simulator to check Expo work tests a platform the project does
not ship — and an Android emulator says nothing about the Swift app.

The two apps are separate codebases, so a feature in one does not appear in the
other by itself. Declare the gap in the PR's `## Parity` section
(`docs/parity.md`).
