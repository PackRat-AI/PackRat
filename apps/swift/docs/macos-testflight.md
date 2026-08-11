# Shipping the macOS app to TestFlight

The native Swift app has a `PackRat-macOS` target that ships to TestFlight
under the **production** App Store Connect record — `com.andrewbierman.packrat`,
app id `6499243187`, the same record the Expo iPhone app ships from. One record
hosts both platforms, so Mac testers find the build under TestFlight's **macOS**
tab. (iOS builds of the Swift app go to a separate record,
`com.andrewbierman.packrat.swift`, app id `6791633696`.)

## Uploading

> **`upload-testflight.ts` has no macOS lane.** The script is built around iOS
> lanes (`--replacement` / `--side-by-side`) whose config module is iOS-specific
> throughout — scheme selection, `PACKRAT_IOS_BUNDLE_IDENTIFIER`, IPA
> verification. Adding a macOS lane means extending
> `scripts/lib/testflight-config.ts`; until then, run the three steps below by
> hand.

Pick the API the build should talk to:

| Scheme | Config | `PACKRAT_ENV` | API |
|---|---|---|---|
| `PackRat-macOS` | Release | `production` | `packrat-api...` |
| `PackRat-macOS-Staging` | Staging | `dev` | `packrat-api-dev...` |

A Release build writes testers' packs and trips into the **production**
database; Staging keeps them off it. Both schemes use the same bundle id, so
whichever you upload last is the build testers get on the macOS tab.

Pick a build number above the highest already in App Store Connect. The
convention is date-based (`2026081101` = 2026-08-11, revision 01). Note that a
Unix timestamp — the default `upload-testflight.ts` uses for iOS — is *smaller*
than these date-style numbers and would be rejected.

```bash
# 1. Archive (swap the scheme/config pair from the table above)
xcodebuild archive -project apps/swift/PackRat.xcodeproj \
  -scheme PackRat-macOS -configuration Release \
  -destination 'generic/platform=macOS' \
  -archivePath /tmp/PackRat-mac.xcarchive \
  -allowProvisioningUpdates \
  MARKETING_VERSION=2.2.0 CURRENT_PROJECT_VERSION=2026081101 \
  DEVELOPMENT_TEAM=666HGMV2LU

# 2. Export a signed .pkg using the manual-signing options below
xcodebuild -exportArchive -archivePath /tmp/PackRat-mac.xcarchive \
  -exportPath /tmp/PackRat-mac-export \
  -exportOptionsPlist /tmp/ExportOptions-mac.plist

# 3. Validate, then upload (--type osx; a macOS App Store export is a .pkg)
set -a && . apps/swift/.env.local && set +a
xcrun altool --validate-app --type osx \
  --file /tmp/PackRat-mac-export/PackRat-macOS.pkg \
  --username "$APPLE_ID" --password "$APPLE_APP_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID"
xcrun altool --upload-app --type osx \
  --file /tmp/PackRat-mac-export/PackRat-macOS.pkg \
  --username "$APPLE_ID" --password "$APPLE_APP_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID"
```

Always `--validate-app` first. It runs the same asset and signing checks as the
real upload but costs nothing, so a rejection is caught before a 25 MB transfer
and is cleanly distinguishable from a transport failure.

`ExportOptions-mac.plist` — note `signingStyle` is **manual** (see below):

```xml
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>666HGMV2LU</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>installerSigningCertificate</key><string>3rd Party Mac Developer Installer</string>
  <key>provisioningProfiles</key>
  <dict><key>com.andrewbierman.packrat</key><string>PackRat macOS App Store</string></dict>
  <key>uploadSymbols</key><true/>
</dict></plist>
```

Roughly 10 minutes to archive and export, plus 5–15 minutes of Apple-side
processing before the build appears in TestFlight.

### The Apple ID belongs to two teams

`altool` fails any *listing* command run without a provider:

```
ERROR: Username and app password authentication requires --provider-public-id,
when attached to multiple providers.
```

It then prints the providers and their public IDs. For read commands pass
`--provider-public-id f1c3497f-0df6-4b85-ad1c-55de20764ec5` (Bierman Collective
LLC). For `--upload-app` / `--validate-app`, `--asc-provider` takes the provider
*short name*, which for this team is the same string as the team ID
(`666HGMV2LU`) — which is why `--asc-provider "$APPLE_TEAM_ID"` works.

`altool` can also authenticate with an App Store Connect API key
(`--apiKey <id> --apiIssuer <uuid>`) instead of an Apple ID and app-specific
password. The key must sit in one of `./private_keys`, `~/private_keys`,
`~/.private_keys`, or `~/.appstoreconnect/private_keys`. There is a key at
`~/.appstoreconnect/private_keys/AuthKey_UL4PZ262H5.p8`, but the issuer UUID it
needs is not recorded anywhere in the repo.

## Signing: why macOS uses manual signing

This machine has certificates in its keychain but **no Apple ID configured in
Xcode's GUI**. Automatic signing asks Xcode's account system for profiles and
fails with `No Accounts` / `No profiles for 'com.andrewbierman.packrat' were
found`. The macOS export therefore names its certificates and profile
explicitly. It needs three things to exist:

| Thing | Value |
|---|---|
| App signing cert | `Apple Distribution: Bierman Collective LLC (666HGMV2LU)` |
| Installer signing cert | `3rd Party Mac Developer Installer: Bierman Collective LLC` |
| Provisioning profile | `PackRat macOS App Store` (MAC_APP_STORE, for `com.andrewbierman.packrat`) |

Verify all three before archiving:

```bash
security find-identity -v | grep -E "Apple Distribution|Installer"
for f in ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*.provisionprofile; do
  security cms -D -i "$f" | plutil -p - | grep '"Name"'
done
```

A macOS App Store export produces a **`.pkg`**, not a `.ipa`, and the `.pkg`
must be signed by the *installer* certificate — a distinct cert from the one
that signs the `.app`.

If any of these are missing, create them through the App Store Connect API
rather than the Xcode GUI. The API can create certificates from an `openssl`
CSR (including `MAC_INSTALLER_DISTRIBUTION`), create `MAC_APP_STORE` profiles,
and add a macOS platform to an existing app record by POSTing a `MAC_OS`
`appStoreVersion`. Install a new profile into
`~/Library/Developer/Xcode/UserData/Provisioning Profiles/`, and import a new
certificate with `security import` (use `openssl pkcs12 -export -legacy`; the
modern default encryption fails macOS keychain import with a misleading
"wrong password" error).

## "The build uploaded but there's no macOS tab in TestFlight"

A build can be `VALID` and still be invisible to testers. Check its beta state:

```
GET /v1/builds/<id>/buildBetaDetail?fields[buildBetaDetails]=internalBuildState,externalBuildState
```

`MISSING_EXPORT_COMPLIANCE` means Apple is waiting on the encryption question
and hides the build until it's answered — TestFlight shows no macOS tab at all,
with nothing to explain why. `project.yml` sets
`ITSAppUsesNonExemptEncryption: false` on the macOS target so this is answered
at build time. To unblock a build that was already uploaded without it:

```
PATCH /v1/builds/<id>   {"data":{"type":"builds","id":"<id>",
                          "attributes":{"usesNonExemptEncryption":false}}}
```

The state should flip to `IN_BETA_TESTING`. Internal groups get every build
automatically — trying to POST an internal group to
`/v1/builds/<id>/relationships/betaGroups` returns 422 and isn't needed.

## Three things that will get an upload rejected

All three are fixed in `project.yml`. They're documented here because the
failure modes are non-obvious and each was hit for real.

**Missing icon (90236).** The asset catalog must be listed under the target's
`sources`, not `resources`. As a resource it is copied verbatim and `actool`
never runs, so the app ships with no `Assets.car` and no `AppIcon.icns` even
though the 1024×1024 PNG is present on disk.

**Missing category (90242).** `LSApplicationCategoryType` is required for Mac
App Store distribution. The build warns about this but still succeeds locally,
so it is easy to miss until Apple rejects the upload.

**Ad-hoc signing.** The target used `CODE_SIGN_IDENTITY: "-"` with an empty
`DEVELOPMENT_TEAM`, which cannot produce a distributable build at all. E2E and
CI still build unsigned by passing `CODE_SIGNING_REQUIRED=NO` on the
`xcodebuild` command line, which overrides the project setting.

To check a built app before spending an upload:

```bash
APP=/tmp/PackRat-mac.xcarchive/Products/Applications/PackRat-macOS.app
ls "$APP/Contents/Resources/" | grep -E 'icns|Assets.car'   # want both
plutil -p "$APP/Contents/Info.plist" | grep -iE 'icon|Category|Encryption'
```

## Sandbox

The target is sandboxed (`com.apple.security.app-sandbox`) with only
`com.apple.security.network.client`. Anything needing more — keychain sharing,
file access outside the container — needs its entitlement added, or it will
fail at runtime in a way that does not show up in a local unsandboxed run.
