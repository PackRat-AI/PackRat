# Expo → Swift auth carryover

**Status: PASSING.** Re-verified 2026-08-14 with both builds on the production
team (`666HGMV2LU`) and `PACKRAT_ENV=dev`. A user signed in on Expo lands
signed in on the Swift app after installing over it — "Good afternoon, QA1",
no login prompt, `GET /api/user/profile → 200` using the migrated Expo cookie.
Evidence: `40-expo-signed-in-same-team.png`, `41-swift-auth-carried-over-PASS.png`.

Two things had to be true, and both were false in the first attempt:

1. **The legacy read must query `app:no-auth`** — fixed in `a50d347bc`. This is
   the only real product bug of the three; see the last section.
2. **Both builds must be on the same Apple team**, and the Swift build must
   point at the same backend as Expo (`PACKRAT_ENV=dev`). Both were local test
   rig faults, not product bugs — details below.

The original failing investigation follows, kept because the false starts are
what the next person will hit too.

## Original failure: why the simulator test logged the user out

Verified on iPhone 17e (`F4296F70-71BB-4228-AC80-8CEE8241DB8D`), 2026-08-14, by
signing in on the Expo build as `qa1.admin@packratai.com` and installing the
Swift build over it under the same bundle id with no uninstall.

## Outcome

| | Before (Expo) | After (Swift) |
|---|---|---|
| Session | signed in, ADMIN | **auth gate — signed out** |
| Packs / trips / items | 113 / 47 / 48 | 113 / 47 / 48, imported as **guest** |

Data carryover works. The session did not survive, and the library was
re-queued as 210 unsynced guest changes.

## Root cause: the two builds get different keychain access groups

Neither app declares `keychain-access-groups`, so iOS falls back to the
`application-identifier` entitlement baked into each binary. Those differ:

```
$ strings PackRat.app/PackRat     | grep -E '5H4G7HU6A7|666HGMV2LU'
application-identifier$5H4G7HU6A7.com.andrewbierman.packrat   # Expo

$ strings PackRat-iOS.app/PackRat-iOS | grep -E '5H4G7HU6A7|666HGMV2LU'
application-identifier$666HGMV2LU.com.andrewbierman.packrat   # Swift
```

Keychain access groups are team-prefixed, so a different team prefix means a
different group and no shared access. Instrumenting `readRawKeychainValue` and
enumerating every generic-password item the Swift app can see returned:

```
KCDUMP status=-25300 count=0
```

Zero items — not a wrong service name, and not a permissions failure
(`errSecItemNotFound`, never `errSecInteractionNotAllowed`). Meanwhile the
simulator keychain does hold the cookie Expo wrote during the login:

```
rowid | agrp                                 | created (UTC)
88    | 5H4G7HU6A7.com.andrewbierman.packrat | 2026-08-14 10:03:39
```

The item is present and untombstoned. The Swift app simply cannot see that
group.

## What this does and does not tell us about production

`apps/expo/ios/` is **gitignored** — a local `expo prebuild` artifact. Its
`DEVELOPMENT_TEAM = 5H4G7HU6A7` came from whoever last ran prebuild on this
machine, and it is not what EAS uses: `eas.json` pins no team, so EAS signs with
the credentials stored against the Expo account.

Every shipping reference in the repo is `666HGMV2LU` (Bierman Collective LLC) —
`apps/swift/project.yml`, `.github/workflows/swift-staging-adhoc.yml`,
`docs/macos-testflight.md`, `apps/swift/.env.local`. The App Store Connect API
key for `666HGMV2LU` authenticates against app `6499243187` (PackRat AI,
`com.andrewbierman.packrat`) and can read its builds, so that team owns the live
record.

**So the local reproduction is a local-only mismatch.** It does not by itself
prove production users are affected. What it does prove is that the carryover
depends entirely on both builds sharing a team prefix, and nothing in the code
enforces or checks that.

## Resolved: production is on one team

Confirmed by the repo owner — every PackRat app, Expo and Swift, is under
Bierman Collective (`666HGMV2LU`). The shipped Expo builds and the Swift app
therefore share a team prefix and land in the same default keychain access
group.

**The access-group failure reproduced here was a local-only artifact**: the
gitignored `apps/expo/ios/` prebuild on this machine carried a stale
`DEVELOPMENT_TEAM = 5H4G7HU6A7`, so the locally built Expo app wrote into a
group no production build uses. Regenerating the prebuild (or `expo prebuild
--clean`) removes it. It is not a user-facing bug, but it will silently break
any local carryover test until the prebuild is refreshed — which is what made
the real defect below so hard to see.

## Third false start: the Swift build pointed at a backend nobody was running

With the teams aligned the app *still* showed the auth gate. The keychain
diagnostics printed nothing at all — because the legacy read was never reached.
The console showed why:

```
→ GET http://localhost:8787/api/user/profile
```

`PACKRAT_ENV` defaults to `local` in `xcconfig/Config-Debug.xcconfig`, and a
bare `xcodebuild` invocation does not pick up `Config-Debug.local.xcconfig`
(which correctly says `dev`). So the app found the migrated token, called a
dead `localhost:8787`, and fell back to signed-out. Pass `PACKRAT_ENV=dev` on
the `xcodebuild` command line when testing carryover:

```
xcodebuild -project PackRat.xcodeproj -scheme PackRat-iOS \
  -destination 'platform=iOS Simulator,id=<udid>' PACKRAT_ENV=dev build
```

Verify with `PlistBuddy -c "Print :PACKRAT_ENV" <app>/Info.plist` before
installing — a signed-out screen looks identical whether the cause is the
keychain or an unreachable API.

## The real user-facing defect

With the teams aligned, the remaining bug is the one that would actually ship:

`a50d347bc` — the legacy read queried the wrong service name.
`expo-secure-store` appends `":no-auth"`/`":auth"` to its default `"app"`
service on every write, so a real install stores `packrat_cookie` under
`app:no-auth`. `KeychainService` only queried bare `"app"`. That is a genuine
second bug that would surface the moment the access-group issue is resolved; it
was masked because `saveLegacyExpoCookieForTesting` seeded the same wrong
service the reader used.
