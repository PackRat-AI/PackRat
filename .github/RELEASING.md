# Release Pipeline — Testing Guide

This document covers how to test the automated mobile release pipeline before using it for a real release. Work through the steps in order.

---

## Prerequisites

Confirm these secrets exist in the repo's GitHub Settings → Secrets and variables → Actions:

| Secret | Purpose |
|---|---|
| `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` | Private package install |
| `EXPO_TOKEN` | EAS CLI authentication |
| `SENTRY_AUTH_TOKEN` | Sentry release creation |
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | Sentry project slug |

---

## Step 1 — Dry-run validation (always run this first)

**Goal**: Verify every local stage computes correctly without touching remote state.

1. Go to **Actions → Release Cut → Run workflow**.
2. Enter any valid next version (e.g. `2.0.27`). Check **Dry run**.
3. Wait for all jobs to finish, then open the **cut** job's **Summary** tab.

**What to verify:**

| Check | Where to look |
|---|---|
| Pre-flight jobs all green | Job list — preflight-typecheck, preflight-lint, preflight-tests |
| Version normalized correctly (no double `v`) | Summary table — Tag row shows `v2.0.27` |
| Branch name is `release/v2.0.27` | Summary table — Release branch row |
| Previous release tag detected | Summary table — Previous release row |
| Changelog contains expected commits | Summary — Changelog preview section |
| API changed flag is correct | Summary — API changed row; cross-check with `git diff <prev-tag> development -- packages/api/` locally |
| All remote actions unchecked | Summary — Remote actions section shows `[ ]` for all |
| No branch created on origin | `git branch -r \| grep release` returns nothing |
| No tag pushed | `git ls-remote --tags origin 'refs/tags/v2.0.27'` returns nothing |
| No GitHub Release created | Releases page on GitHub shows no new entry |
| No PR opened | Pull Requests tab shows no release PR |
| `eas-build-dryrun` job shows correct commands | Job log shows both platforms, correct profile and submit targets |

---

## Step 2 — Pre-flight failure test

**Goal**: Confirm the workflow fails fast when checks fail and does not touch git.

1. On the `development` branch, introduce a deliberate type error in any TypeScript file (e.g. assign a string to a number-typed variable).
2. Run **Release Cut** with any version and **Dry run: true**.
3. Expect:
   - `preflight-typecheck` fails and shows the type error.
   - The `cut` job is skipped (never runs).
   - No branch, tag, PR, or release is created.
4. Revert the type error before moving on.

Repeat with a lint error (add an unused import or a rule violation) to exercise `preflight-lint`, and with a failing test to exercise `preflight-tests`.

---

## Step 3 — Concurrency lock test

**Goal**: Confirm two simultaneous release runs do not race.

1. Trigger **Release Cut** (dry run, any version).
2. Before it finishes, trigger it again with a different version.
3. Expect: the second run queues and waits (it does **not** cancel the first, because `cancel-in-progress: false`).
4. Once the first run finishes, the second starts.

---

## Step 4 — Full live run (test version)

**Goal**: Exercise all remote operations end-to-end without shipping to stores.

> Use a dedicated test version number that is clearly not a real release, e.g. `0.0.1-test`. Delete all artifacts after the test.

1. Run **Release Cut** with version `0.0.1-test`, **Dry run: false**.
2. Wait for the `cut` job to complete. Verify:
   - Branch `release/v0.0.1-test` exists on origin.
   - Tag `v0.0.1-test` exists on origin.
   - GitHub Release `PackRat v0.0.1-test` exists with the generated changelog.
   - A PR from `release/v0.0.1-test` → `main` is open with the correct title and body.
   - The **API changed** note in the PR body matches what the Summary showed.
3. If **API unchanged**: verify the `eas-build` job starts and appears in the [EAS dashboard](https://expo.dev). Cancel it immediately to avoid a real store submission.
4. If **API changed**: the `eas-build` job should be skipped. Verify `release-deploy.yml` is **not** running yet.

**Cleanup**: close the PR without merging, delete the branch `release/v0.0.1-test` and the tag `v0.0.1-test` from origin, delete the GitHub Release.

---

## Step 5 — Post-merge deploy test (release-deploy.yml)

**Goal**: Verify the automatic EAS trigger fires when a release PR merges to main.

> Only run this against a test version and with the EAS build ready to be cancelled.

1. Complete Step 4 up through PR creation.
2. Merge the test PR to main.
3. Go to **Actions** and confirm `Release Deploy` triggered automatically.
4. Verify the job name shows the correct release branch ref.
5. Confirm the EAS build appears in the EAS dashboard and the Sentry release is created.
6. Cancel the EAS build immediately to avoid a store submission.

**Cleanup**: same as Step 4, plus delete the merged branch.

---

## Step 6 — Real release

Once Steps 1–5 pass cleanly, the pipeline is ready for a real release.

1. Run **Release Cut**, enter the real version, **Dry run: false**.
2. Review the PR and the GitHub Release changelog — edit the release body if the generated copy needs polish.
3. Get QA sign-off and merge the PR.
4. Monitor EAS builds in the [EAS dashboard](https://expo.dev).
5. Monitor store review status:
   - **iOS**: App Store Connect → My Apps → TestFlight or App Store tab.
   - **Android**: Google Play Console → Release → Production.
6. Confirm the Sentry release appears at sentry.io with commits associated.

---

## Rollback

If the EAS build or store submission fails after a real release cut:

1. **Do not** delete the tag or the GitHub Release — they are public and pinned.
2. Cancel the EAS build from the EAS dashboard if it is still running.
3. Fix the root cause on the `release/vX.Y.Z` branch (not on development).
4. Commit the fix, push the branch.
5. Re-run **Release Cut** with the same version — the bump step will fail on "working directory not clean" because the tag already exists locally. Instead, trigger the `eas-build` job directly from the EAS dashboard or push a manual `eas build` command, then create the Sentry release manually:
   ```bash
   bunx @sentry/cli releases new <version>
   bunx @sentry/cli releases set-commits <version> --auto
   bunx @sentry/cli releases finalize <version>
   ```
