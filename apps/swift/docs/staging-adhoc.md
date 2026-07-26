# Staging ad-hoc QA builds

The Swift app has three build tiers, mirroring the Expo `development / preview /
production` workflow:

| Xcode config | `PACKRAT_ENV` | API | Who / how |
|---|---|---|---|
| **Debug** | `local` | your Mac's wrangler dev | Local dev — hit **Run** in Xcode |
| **Staging** | `dev` | deployed dev API | QA — ad-hoc `.ipa` on a GitHub pre-release |
| **Release** | `production` | production API | App Store — Archive |

`PACKRAT_ENV` is set per-config in `xcconfig/Config-*.xcconfig`, substituted into
`Info.plist`, and read at runtime by `APIClient.resolvedBaseURL`.

Running on a **physical device** in Debug? `localhost` is the phone, not your
Mac — point Debug at the deployed dev API with the gitignored override:

```sh
echo "PACKRAT_ENV = dev" > apps/swift/xcconfig/Config-Debug.local.xcconfig
```

## The staging workflow

`.github/workflows/swift-staging-adhoc.yml` (manual `workflow_dispatch`):

1. Generates the Xcode project (`bun swift`).
2. Imports the distribution cert + ad-hoc provisioning profile into a temp keychain.
3. `xcodebuild archive -configuration Staging` → `xcodebuild -exportArchive` (`method: ad-hoc`).
4. Publishes the `.ipa` as a GitHub **pre-release** (`prerelease: true`).

Ad-hoc distribution is **device-scoped**: only devices whose UDID is in the
provisioning profile can install the build.

> **Why GitHub Actions and not EAS?** EAS Build assumes a React Native/Expo
> project (`package.json` + `ios/Podfile`); `apps/swift` is a native
> xcodegen-generated `.xcodeproj` with SPM, so EAS can't build it without a
> fragile custom-build pipeline. We build on GitHub Actions instead and manage
> the signing assets ourselves (below).

## Required GitHub secrets

| Secret | What it is |
|---|---|
| `IOS_DIST_CERT_P12` | base64 of an Apple **Distribution** certificate + private key exported as `.p12` |
| `IOS_DIST_CERT_PASSWORD` | the password you set when exporting the `.p12` |
| `IOS_ADHOC_PROVISIONING_PROFILE` | base64 of an **ad-hoc** `.mobileprovision` for `com.andrewbierman.packrat.swift`, listing QA device UDIDs |

Team ID `666HGMV2LU` and bundle id `com.andrewbierman.packrat.swift` are hard-coded in
the workflow's export options — update them there if they change.

Both the cert and the profile are created **fresh** here (an admin on the Apple
team is required). Two ways to make them — pick one.

### Option A — one command with fastlane (recommended)

`fastlane` creates the distribution cert **and** the ad-hoc profile from the CLI;
you just approve the Apple 2FA prompt on your device. Requires an admin Apple ID.

```sh
brew install fastlane   # or: gem install fastlane

# 1. Register QA devices (name + UDID). Get a UDID via Finder → device → click
#    the info line → right-click → Copy UDID, or Xcode → Devices and Simulators.
fastlane run register_devices \
  devices:'{"Ibrahim iPhone":"00008120-000XXXXXXXXXXX"}' \
  team_id:666HGMV2LU

# 2. Create/download the Apple Distribution certificate → writes a .cert + .p12.
fastlane run cert \
  development:false \
  team_id:666HGMV2LU \
  output_path:./signing

# 3. Create the ad-hoc profile for the Swift bundle id, including all registered
#    devices → writes a .mobileprovision.
fastlane run sigh \
  adhoc:true \
  app_identifier:com.andrewbierman.packrat.swift \
  team_id:666HGMV2LU \
  output_path:./signing
```

Then encode the two files into the secrets (the `.p12` password is whatever you
gave `cert`; if it didn't prompt, it's empty — set `IOS_DIST_CERT_PASSWORD=""`):

```sh
base64 -i ./signing/*.p12            | pbcopy   # → IOS_DIST_CERT_P12
base64 -i ./signing/*.mobileprovision | pbcopy  # → IOS_ADHOC_PROVISIONING_PROFILE
```

> `./signing` holds private keys — it's outside the repo working tree here, but
> delete it once the secrets are set: `rm -rf ./signing`.

### Option B — Apple Developer portal (manual)

Portal home: **developer.apple.com/account → Certificates, Identifiers &
Profiles**. Left menu has **Certificates · Identifiers · Devices · Profiles**.

1. **Devices** → **＋** → register each QA device (name + UDID).
2. **Identifiers** → confirm an App ID for `com.andrewbierman.packrat.swift`
   exists; if not, **＋** → App IDs → App → Explicit bundle id → Register.
3. **Certificates** → **＋** → **Apple Distribution** → follow the CSR steps
   (Keychain Access → Certificate Assistant → Request a Certificate from a CA),
   upload the CSR, download the `.cer`, double-click to add it to your Keychain.
   In **Keychain Access**, find the cert, expand it, select **both** the cert and
   its private key → right-click → **Export 2 items** → save as `.p12` (set a
   password = `IOS_DIST_CERT_PASSWORD`).
4. **Profiles** → **＋** → **Ad Hoc** → App ID `com.andrewbierman.packrat.swift`
   → select the distribution cert from step 3 → check every registered device →
   name it `PackRat Swift Ad Hoc` → **Generate** → **Download**.

Encode both:

```sh
base64 -i dist.p12                    | pbcopy   # → IOS_DIST_CERT_P12
base64 -i PackRat_Swift_Ad_Hoc.mobileprovision | pbcopy  # → IOS_ADHOC_PROVISIONING_PROFILE
```

### Add the secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add `IOS_DIST_CERT_P12`, `IOS_DIST_CERT_PASSWORD`, and
`IOS_ADHOC_PROVISIONING_PROFILE`.

> The profile is bound to the cert you selected: the workflow must sign with the
> same cert whose `.p12` is in `IOS_DIST_CERT_P12`, or the export fails.

### Adding a new QA device

1. Register the device UDID: Apple Developer → Devices.
2. Regenerate the ad-hoc profile (it must include the new UDID) and download it.
3. Re-encode and update the `IOS_ADHOC_PROVISIONING_PROFILE` secret.
4. Re-run the workflow — older `.ipa`s won't install on the new device.

## Running it

Actions → **Swift Staging Ad-Hoc** → **Run workflow**. Optional `tag` input
(defaults to `staging-<run_number>`). Testers download the `.ipa` from the
pre-release and install it (e.g. via Apple Configurator or a device-management
tool).
