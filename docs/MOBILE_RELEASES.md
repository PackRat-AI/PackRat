# Mobile App Release Pipeline

## Overview

The PackRat mobile app uses an automated release pipeline that builds apps locally using GitHub Actions runners and submits them to the App Store and Google Play Store when merging from `release/*` branches to the `main` branch.

## How It Works

### Trigger

The release workflow (`release-production.yml`) triggers automatically when:
- A pull request from a `release/*` branch is merged to the `main` branch
- Changes affect the mobile app (`apps/expo/**`) or shared packages (`packages/**`)
- The workflow file itself is modified

The workflow uses a `pull_request` trigger with type `closed` and checks for:
- `github.event.pull_request.merged == true` (PR was merged, not just closed)
- `startsWith(github.event.pull_request.head.ref, 'release/')` (source branch starts with `release/`)

This approach works reliably regardless of merge strategy (merge commit, squash, or rebase).

You can also trigger it manually via GitHub Actions UI using the "Run workflow" button.

### Build Architecture

The workflow uses **local builds** instead of EAS cloud builds:
- **iOS builds** run on `macos-14` runners with native tooling
- **Android builds** run on `ubuntu-latest` runners with Docker
- Both builds execute in parallel for faster completion
- Artifacts are uploaded and shared between jobs

### Workflow Steps

1. **Build Phase** (Parallel Jobs)
   - **build-ios**: Runs `eas build --local` on macOS for iOS
   - **build-android**: Runs `eas build --local` on Linux for Android
   - Each job uploads the built artifact (.ipa or .aab)

2. **Submit Phase** (Sequential, after builds complete)
   - Downloads both iOS and Android artifacts
   - Submits iOS build to App Store Connect using `eas submit --path`
   - Submits Android build to Google Play Console using `eas submit --path`
   - Reports submission status

3. **Reporting**
   - Creates a deployment summary with build and submission status
   - Logs any failures as warnings or errors

### Benefits of Local Builds

- **Cost**: No EAS cloud build credits required
- **Speed**: Builds run directly on GitHub runners (parallel execution)
- **Control**: Full visibility into build process and logs
- **Artifacts**: Builds stored as GitHub artifacts (30-day retention)
- **Flexibility**: Easy to debug and modify build steps

## EAS Configuration

The workflow uses the `production` profile from `apps/expo/eas.json`:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "production"
      },
      "ios": {
        "ascAppId": "6499243187"
      }
    }
  }
}
```

Key features:
- **autoIncrement**: Automatically increments build numbers
- **channel**: Uses the "production" update channel
- **track**: Android submissions go to the "production" track
- **ascAppId**: iOS submissions use the specified App Store Connect app ID

## Required Secrets

The workflow requires the following GitHub repository secrets:

| Secret | Description | Used For |
|--------|-------------|----------|
| `EXPO_TOKEN` | Expo authentication token | EAS build and submit commands |
| `EXPO_APPLE_APP_SPECIFIC_PASSWORD` | Apple app-specific password | iOS submission to App Store |
| `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` | GitHub Packages token | Installing private dependencies |

### Setting Up Secrets

1. **EXPO_TOKEN**: Generate from your Expo account settings
   ```bash
   npx expo login
   npx expo whoami
   # Get token from https://expo.dev/settings/access-tokens
   ```

2. **EXPO_APPLE_APP_SPECIFIC_PASSWORD**: Create an app-specific password at https://appleid.apple.com
   - Sign in with your Apple Developer account
   - Navigate to Security → App-Specific Passwords
   - Generate a new password
   - Store it in GitHub Secrets

3. **PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN**: GitHub Personal Access Token with `read:packages` scope

## Store Submission

### iOS (App Store)

- Builds are submitted to **App Store Connect**
- Review process typically takes 1-3 days
- Builds must pass automated review checks
- After approval, you can release manually or set up automatic release

### Android (Google Play)

- Builds are submitted to the **production track**
- May enter staged rollout depending on Play Console settings
- Review process is usually faster than iOS (hours to 1 day)
- Can configure release settings in Play Console

## Manual Release Process

If you need to release without merging to `main`:

### Using the Workflow

1. Go to Actions → Release Production Builds
2. Click "Run workflow"
3. Select the branch
4. Click "Run workflow" button

### Using EAS CLI Locally

You can also build and submit locally from your development machine:

```bash
cd apps/expo

# Build locally for iOS (requires macOS with Xcode)
eas build --platform ios --profile production --local

# Build locally for Android (requires Docker)
eas build --platform android --profile production --local

# Submit with path to local build
eas submit --platform ios --path ./path/to/build.ipa --profile production
eas submit --platform android --path ./path/to/build.aab --profile production
```

## Troubleshooting

### Build Failures

If a build fails:
1. Check the workflow run logs in GitHub Actions
2. Review the build output in the job logs
3. Common issues:
   - Native dependency mismatches
   - Invalid credentials
   - Code signing issues (iOS)
   - Insufficient runner disk space
   - Docker issues (Android on Linux)

### Submission Failures

If submission fails but build succeeds:
1. Check if the build meets store requirements
2. Verify secrets are correctly set
3. For iOS: Ensure Apple Developer account is in good standing
4. For Android: Check Play Console service account permissions
5. Verify artifact was properly downloaded in the submit job

### Partial Success

The workflow uses `continue-on-error: true` for submissions, so:
- If one platform fails, the other will still attempt submission
- Check the deployment summary for individual status
- You can manually submit the failed platform using EAS CLI

## Monitoring Releases

### GitHub Actions

- View all releases: Actions → Release Production Builds
- Each run shows:
  - Build job status (iOS and Android separately)
  - Artifact uploads
  - Submission status
  - Links to stores

### Build Artifacts

- Artifacts are stored in GitHub Actions for 30 days
- Download from the workflow run page
- iOS: `.ipa` file
- Android: `.aab` file

### App Store Connect / Play Console

- **iOS**: https://appstoreconnect.apple.com
- **Android**: https://play.google.com/console

## Version Management

Version numbers are managed in `apps/expo/package.json`:

```json
{
  "version": "2.0.20"
}
```

Build numbers are automatically incremented by EAS using the `autoIncrement` setting.

### Updating Version

1. Create a release branch: `git checkout -b release/v2.0.21`
2. Update version in `package.json`
3. Commit changes: `git commit -am "Bump version to 2.0.21"`
4. Push and create PR to `main`
5. Merge the PR - workflow automatically builds with new version

## Concurrency Control

The workflow uses:
```yaml
concurrency:
  group: release-production-${{ github.ref }}
  cancel-in-progress: false
```

This ensures:
- Only one production release runs at a time
- Releases are queued if multiple merges happen
- In-progress releases complete before new ones start

## Best Practices

1. **Use Release Branches**
   - Always create a `release/*` branch for production releases
   - Example: `release/v2.0.21` or `release/2024-04-17`
   - Merges from non-release branches to main will NOT trigger deployment

2. **Test Before Release**
   - Run E2E tests before merging to main
   - Use preview builds for QA

3. **Monitor Submissions**
   - Check GitHub Actions for completion
   - Verify builds appear in store dashboards
   - Monitor for rejection notifications

4. **Hotfix Process**
   - For urgent fixes, create a release branch: `release/hotfix-v2.0.22`
   - Make minimal changes
   - Merge to main to trigger release

5. **Version Bumping**
   - Increment version for user-facing changes
   - Follow semantic versioning (MAJOR.MINOR.PATCH)
   - Coordinate with release notes

## Related Workflows

- **E2E Tests** (`e2e-tests.yml`): Runs Maestro tests on iOS and Android
- **Release Mobile Apps** (`release-ios.yml`): Tag-based manual release workflow

## Support

For issues with:
- **EAS builds**: Check Expo documentation at https://docs.expo.dev/build/introduction/
- **Store submissions**: Check platform-specific guidelines
- **Workflow failures**: Review GitHub Actions logs and reach out to the team
