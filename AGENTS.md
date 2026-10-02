# PackRat — instructions for coding agents

This file is the shared instruction set for coding agents that read
`AGENTS.md`. Claude Code reads [`CLAUDE.md`](./CLAUDE.md), which carries the
full conventions; this file states the rules an agent most needs before it
builds, tests, or launches anything.

<!-- Keep this file short and keep it a summary. It was previously a full copy
of CLAUDE.md; the two drifted, and the platform split below reached one file
and not the other. If a convention belongs to every agent, put it in CLAUDE.md
and summarise it here. -->

## Mobile is split by platform

**Each mobile platform has its own codebase.**

| Platform | Codebase | Validate on |
|---|---|---|
| iOS, watchOS, macOS | `apps/swift` (SwiftUI) | Apple simulator or device |
| Android | `apps/expo` (React Native) | Android emulator or device |

**iOS is not shipped from Expo.** The Expo project still has an iOS target and
it still builds, but no store build comes from it, so a bug that only
reproduces there is not worth fixing.

Consequences worth holding in mind:

- A change in `apps/expo` is validated on **Android**. Launching an iOS
  simulator to check it tests a platform the project does not ship.
- A change in `apps/swift` is validated on an **Apple** simulator or device. An
  Android emulator says nothing about it.
- An iOS bug report is fixed in `apps/swift`, not in `apps/expo`.
- EAS builds Android. iOS/watchOS/macOS ship via Xcode and App Store Connect.

Each app directory carries its own `AGENTS.md` and `CLAUDE.md` with that
platform's specifics.

## Everything else

See [`CLAUDE.md`](./CLAUDE.md) for architecture, commands, code style, database
and migration rules, feature gating, testing policy, and Sentry conventions.
