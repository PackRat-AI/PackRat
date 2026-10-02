# apps/expo — the Android app

**This workspace ships Android. It does not ship iOS.**

iOS, watchOS and macOS ship from `apps/swift` (SwiftUI). The Expo project still
has an iOS target and it still builds, but it is not a shipping surface: no
store build comes from it, and bugs that only reproduce there are not worth
fixing.

## Validate on Android

Anything you change here is validated on an **Android emulator or device**:

```bash
bun android        # Android emulator — the shipping target
bun expo           # Metro, then connect the Android dev client
```

Do not boot an iOS simulator to check a change made in this directory. A green
run on iOS says nothing about what users get, and it costs a slow build to
learn nothing. If you need to see an iOS behaviour, the code is in
`apps/swift` — go there instead.

`bun ios` still exists for the rare case of debugging shared JS in a second
runtime. Treat a result from it as a hint, never as validation.

## Android dev-client gotchas

- The dev launcher **ignores `?url=` in a deep link**. Open the launcher, tap
  the `exp://` field, type the dev-server URL, then tap Connect.
- Emulators reach the host at `10.0.2.2`; a physical device needs the LAN IP
  from `ipconfig getifaddr en0`. `adb reverse tcp:8081 tcp:8081` also works.
- A fresh emulator can boot with **airplane mode on**, which makes the host
  unreachable and looks exactly like a broken bundler.
- On a cold emulator the dev client can ANR on first launch ("failed to
  complete startup"). Relaunch once it is warm.
- Prefer raw `adb` over higher-level device wrappers here: `adb shell input
  tap`, `adb exec-out screencap -p`, `adb shell uiautomator dump`.

## Parity with iOS

The two apps are separate codebases, so a feature added here does not appear on
iOS by itself. Declare the gap in the PR's `## Parity` section — the template in
`.github/PULL_REQUEST_TEMPLATE.md` asks for it and `.github/workflows/parity.yml`
opens the counterpart issue. Full contract: `docs/parity.md`.
