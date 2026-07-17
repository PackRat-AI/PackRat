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
> fragile custom-build pipeline. We instead build on GitHub Actions and **reuse
> the one EAS asset that transfers**: the account-wide distribution certificate
> (see below).

## Required GitHub secrets

| Secret | What it is |
|---|---|
| `IOS_DIST_CERT_P12` | base64 of an Apple **Distribution** certificate exported as `.p12` |
| `IOS_DIST_CERT_PASSWORD` | the password you set when exporting the `.p12` |
| `IOS_ADHOC_PROVISIONING_PROFILE` | base64 of an **ad-hoc** `.mobileprovision` for `com.andrewbierman.packrat.swift`, listing QA device UDIDs |

Team ID `666HGMV2LU` and bundle id `com.andrewbierman.packrat.swift` are hard-coded in
the workflow's export options — update them there if they change.

> **Reuse the cert EAS already manages.** A distribution certificate is
> account-wide (not bundle-id-specific), so the same cert EAS uses for the Expo
> builds signs the Swift app too. Only the **ad-hoc profile** must be new,
> because a provisioning profile *is* bundle-id-specific and EAS's profiles are
> issued for the Expo bundle ids (`com.andrewbierman.packrat[.preview]`), not
> `com.andrewbierman.packrat.swift`. So the only net-new Apple asset here is the
> one ad-hoc profile below.

### Generating the secrets

**Distribution certificate — reuse EAS's.** Export it from the credentials EAS
already manages instead of minting a new one (Apple caps distribution certs per
account, so don't create a duplicate):

```sh
cd apps/expo
eas credentials -p ios            # → Distribution Certificate → export .p12
base64 -i dist.p12 | pbcopy       # → IOS_DIST_CERT_P12
                                  #   IOS_DIST_CERT_PASSWORD = the export password
```

If you'd rather not export from EAS, Apple Developer → Certificates → an existing
**Apple Distribution** cert works too — but reuse the private key you already
have; downloading the `.cer` alone can't be exported as a `.p12` without it.

**Ad-hoc provisioning profile — this is the one new asset** (Apple Developer →
Profiles → new **Ad Hoc** profile for the `com.andrewbierman.packrat.swift` App
ID, select that same distribution cert, check every QA device):

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
