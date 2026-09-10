# apps/swift — the Apple app

**This workspace ships iOS, watchOS and macOS.** Android ships from
`apps/expo` (React Native).

There is no React Native in this directory and no Expo tooling in this build.
An iOS bug reported against the app is fixed here, not in `apps/expo` — the
Expo project's iOS target is not shipped.

## Validate on an Apple simulator or device

```bash
bun swift          # regenerate the Xcode project (it is NOT committed)
```

Regenerate after any change to `project.yml`, then build the `PackRat-iOS`
scheme. Pin the simulator explicitly by UDID — this machine runs parallel
agents and each owns its own simulator, so letting the tooling pick one steals
somebody else's device.

Build with a **shared** DerivedData path so worktrees reuse object files rather
than each carrying a 3-6 GB copy:

```
-derivedDataPath "$HOME/Library/Developer/Xcode/DerivedData/PackRat-shared"
```

## Parity with Android

The two apps are separate codebases, so a feature added here does not appear on
Android by itself. Declare the gap in the PR's `## Parity` section — the
template in `.github/PULL_REQUEST_TEMPLATE.md` asks for it and
`.github/workflows/parity.yml` opens the counterpart issue. Full contract:
`docs/parity.md`.

## Release

iOS/watchOS/macOS ship through Xcode and App Store Connect, **not EAS**. EAS
builds the Android app only. See `apps/swift/README.md` for the TestFlight and
preflight commands.
