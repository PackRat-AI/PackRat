# Shipping the macOS app to TestFlight

The native Swift app has a `PackRat-macOS` target that ships to TestFlight
under the **production** App Store Connect record — `com.andrewbierman.packrat`,
app id `6499243187`, the same record the Expo iPhone app ships from. One record
hosts both platforms, so Mac testers find the build under TestFlight's **macOS**
tab. (iOS builds of the Swift app go to a separate record,
`com.andrewbierman.packrat.swift`.)

## Uploading

> **`upload-testflight.ts` has no macOS lane right now.** The script was
> rewritten around iOS lanes (`--replacement` / `--side-by-side`) whose config
> module is iOS-specific throughout — scheme selection,
> `PACKRAT_IOS_BUNDLE_IDENTIFIER`, IPA verification. Adding a macOS lane means
> extending `scripts/lib/testflight-config.ts`; until then, run the three steps
> below by hand.

```bash
# 1. Archive (Release; the macOS target has no Staging scheme)
xcodebuild archive -project apps/swift/PackRat.xcodeproj \
  -scheme PackRat-macOS -configuration Release \
  -destination 'generic/platform=macOS' \
  -archivePath /tmp/PackRat-mac.xcarchive \
  -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION=$(date +%s) DEVELOPMENT_TEAM=666HGMV2LU

# 2. Export a signed .pkg using the manual-signing options below
xcodebuild -exportArchive -archivePath /tmp/PackRat-mac.xcarchive \
  -exportPath /tmp/PackRat-mac-export \
  -exportOptionsPlist /tmp/ExportOptions-mac.plist

# 3. Upload (--type osx; a macOS App Store export is a .pkg, not an .ipa)
set -a && . apps/swift/.env.local && set +a
xcrun altool --upload-app --type osx \
  --file /tmp/PackRat-mac-export/PackRat-macOS.pkg \
  --username "$APPLE_ID" --password "$APPLE_APP_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID"
```

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

Takes roughly 5 minutes to archive and export, plus 5–15 minutes of Apple-side
processing before the build appears in TestFlight.

`altool` can also authenticate with an App Store Connect API key
(`--apiKey <id> --apiIssuer <uuid>`) instead of an Apple ID and app-specific
password. The key must sit in one of `./private_keys`, `~/private_keys`,
`~/.private_keys`, or `~/.appstoreconnect/private_keys`.

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
with nothing to explain why. `project.yml` now sets
`ITSAppUsesNonExemptEncryption: false` on the macOS target so this is answered
at build time. To unblock a build that was already uploaded without it:

```
PATCH /v1/builds/<id>   {"data":{"type":"builds","id":"<id>",
                          "attributes":{"usesNonExemptEncryption":false}}}
```

The state should flip to `IN_BETA_TESTING`. Internal groups get every build
automatically — trying to POST an internal group to
`/v1/builds/<id>/relationships/betaGroups` returns 422 and isn't needed.

## Two things that will get an upload rejected

Both of these were hit on the first attempt and are fixed in `project.yml` —
they're documented here because the failure modes are non-obvious.

**Missing icon (90236).** The asset catalog must be listed under the target's
`sources`, not `resources`. As a resource it is copied verbatim and `actool`
never runs, so the app ships with no `Assets.car` and no `AppIcon.icns` even
though the 1024×1024 PNG is present on disk.

**Missing category (90242).** `LSApplicationCategoryType` is required for Mac
App Store distribution. The build warns about this but still succeeds locally,
so it is easy to miss until Apple rejects the upload.

To check a built app before spending an upload:

```bash
ARCHIVE=<path printed by the script>
ls "$ARCHIVE/Products/Applications/PackRat-macOS.app/Contents/Resources/"  # want AppIcon.icns + Assets.car
plutil -p "$ARCHIVE/Products/Applications/PackRat-macOS.app/Contents/Info.plist" | grep -iE 'icon|Category'
```

## Sandbox

The target is sandboxed (`com.apple.security.app-sandbox`) with only
`com.apple.security.network.client`. Anything needing more — keychain sharing,
file access outside the container — needs its entitlement added, or it will
fail at runtime in a way that does not show up in a local unsandboxed run.
