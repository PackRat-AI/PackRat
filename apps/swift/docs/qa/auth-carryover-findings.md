# Expo → Swift auth carryover: why the simulator test logged the user out

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

## Still to confirm

The team that signed the **shipped** Expo builds (EAS-stored credentials, not
the local prebuild). If those were signed by `666HGMV2LU`, production carryover
works and this was a local artifact. If by any other team, real users are
affected and the fix is an explicit shared `keychain-access-groups` entitlement
on both apps.

`eas credentials` requires interactive auth, so this needs a human with Expo
account access.

## Related fix already landed

`a50d347bc` — the legacy read also queried the wrong service name.
`expo-secure-store` appends `":no-auth"`/`":auth"` to its default `"app"`
service on every write, so a real install stores `packrat_cookie` under
`app:no-auth`. `KeychainService` only queried bare `"app"`. That is a genuine
second bug that would surface the moment the access-group issue is resolved; it
was masked because `saveLegacyExpoCookieForTesting` seeded the same wrong
service the reader used.
