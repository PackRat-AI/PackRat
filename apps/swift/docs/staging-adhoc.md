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

## Required GitHub secrets

| Secret | What it is |
|---|---|
| `IOS_DIST_CERT_P12` | base64 of an Apple **Distribution** certificate exported as `.p12` |
| `IOS_DIST_CERT_PASSWORD` | the password you set when exporting the `.p12` |
| `IOS_ADHOC_PROVISIONING_PROFILE` | base64 of an **ad-hoc** `.mobileprovision` for `com.andrewbierman.packrat`, listing QA device UDIDs |

Team ID `7WV9JYCW55` and bundle id `com.andrewbierman.packrat` are hard-coded in
the workflow's export options — update them there if they change.

### Generating the secrets

**Distribution certificate** (Apple Developer → Certificates → Apple Distribution),
download the `.cer`, add to Keychain, then export the cert **with its private key**
as `.p12`:

```sh
base64 -i dist.p12 | pbcopy   # → IOS_DIST_CERT_P12
```

**Ad-hoc provisioning profile** (Apple Developer → Profiles → new **Ad Hoc**
profile for the `com.andrewbierman.packrat` App ID, select the Distribution cert,
check every QA device):

```sh
base64 -i PackRat_AdHoc.mobileprovision | pbcopy   # → IOS_ADHOC_PROVISIONING_PROFILE
```

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
