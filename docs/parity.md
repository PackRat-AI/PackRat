# Platform parity

PackRat ships two clients from one repo:

| Client | Ships | Path |
|---|---|---|
| **Swift** | iOS + macOS | `apps/swift/` |
| **Expo** | Android | `apps/expo/` |

Expo no longer ships iOS. A change to `apps/expo` is an **Android** change; a
change to `apps/swift` is an **iOS + macOS** change.

The usual order is **iOS leads, then the Mac and Android follow**. Work also lands the other way round, and often as a bug you notice and fix on the spot. Whatever didn't get the change is then supposed to follow. **Nothing remembers that except the
person who was there**, and that is the gap this system closes.

## The rule

Every PR touching `apps/swift/` or `apps/expo/` declares, in a `## Parity`
section of its description, exactly one of:

| Directive | Meaning |
|---|---|
| `follow: <swift\|expo\|mac>[, …] [note]` | Those platforms need this too. One issue per platform is opened automatically on merge. |
| `done-all` (or `done-both`) | iOS, macOS and Android were all handled in this PR. |
| `n/a: <reason>` | Parity genuinely doesn't apply. A reason is required. |

Follow targets:

| Target | Means | Typical case |
|---|---|---|
| `mac` | The Mac app, in `apps/swift` | A Swift PR that only did iOS |
| `expo` | Android | Any Swift PR not yet on Android |
| `swift` | iOS and the Mac | An Expo PR that led |

List several with commas: an iOS-only Swift PR declares `follow: mac, expo`. `swift` already includes the Mac, so `follow: swift, mac` opens just the `swift` issue.

CI blocks the PR if the section is missing or malformed. PRs that touch neither
client are exempt automatically — backend and docs work is never asked about
parity.

### Why a reason is mandatory on `n/a`

An unexplained `n/a` is indistinguishable from forgetting, and forgetting is the
entire failure mode. Writing the reason takes five seconds while you have the
context and is the difference between a decision and an omission.

## What happens on merge

`.github/workflows/parity.yml` reads the declaration. If it says `follow`, it opens one issue per owed platform:

- **Title**: `[parity/expo] <original PR title>` (or `[parity/mac]`, `[parity/swift]`)
- **Labels**: `parity` + `parity:expo` (or `parity:mac`, `parity:swift`)
- **Body**: links the originating PR and author, carries your note, and states
  how to close the gap

Each issue carries a hidden `parity-of:#<pr>` marker and its platform label, so a re-run or a re-merge finds the existing one for that platform instead of opening a duplicate. Duplicate gap issues
would train everyone to ignore the label, which would end the scheme.

The `record` job triggers on **push to `development`/`main`**, resolving the
merged PR from the pushed commit. It deliberately does not use
`pull_request_target`: that trigger is only registered from the workflow file
already present on the base branch when the PR was opened, so it silently
never fires for PRs opened before the workflow landed — which is exactly how
the first end-to-end test failed (PR #2761). A push trigger always fires and
works for forks too. A direct push with no associated PR simply no-ops.

## Where the gap list lives

**The open `parity` issues _are_ the gap list.** There is no document to
maintain:

```bash
bun parity:gaps      # open gaps, straight from GitHub
bun parity:report    # regenerate docs/parity/OPEN-GAPS.md
```

`docs/parity/OPEN-GAPS.md` is a generated snapshot, refreshed weekly and
whenever a parity issue is closed or relabelled. It ages every gap and flags
anything open past 30 days — that marker is the signal that a follow-up is
being dropped rather than scheduled.

Closing a gap is closing the issue. If it turns out parity doesn't apply after
all, close it with a comment saying why.

## Design notes

**Why not a parity matrix?** We had one:
`docs/audits/2026-05-20-feature-parity-matrix.md` (deleted). It was built to
burn down the Expo→Swift iOS migration, which it did. But as an ongoing
instrument it rotted in eleven weeks, because nothing recomputed it — by the
time it was removed, 374 commits had landed on Expo and 301 on Swift against a
document that opened by admitting it was stale.

That failure is well documented outside this repo too. Martin Fowler's
[Feature Parity](https://martinfowler.com/articles/patterns-legacy-displacement/feature-parity.html)
pattern warns that tracking parity as a big list produces "high levels of
completeness being reported and yet an inability to test or release usable
software," and recommends putting parity in the **definition of done for each
piece of work** instead. Mozilla reached the same conclusion from the other
direction, rejecting a global parity keyword in
[bug 247730](https://bugzilla.mozilla.org/show_bug.cgi?id=247730) in favour of
filing per-product bugs.

So the unit of tracking here is **the individual change, captured at merge
time** — not a registry anyone has to keep true.

**Why "swift"/"expo", plus "mac"?** A change lands on a codebase, and one codebase ships two OSes, so `follow: swift` names iOS and the Mac together. The Mac gets its own target because it lags iOS inside the same codebase: an iOS-only Swift PR owes the Mac a follow-up just as it owes Android one, and without `mac` that debt had nowhere to go.

**Behaviour, not transliteration.** A parity issue asks for the same *user-
visible behaviour*, implemented idiomatically for the platform. SwiftUI context
menus versus long-press sheets is parity. Porting code line-for-line isn't the
goal.

**iOS leads by default.** Any platform may go first, but the expected order is iOS, then the Mac and Android. This mirrors how VLC
runs the same two-client problem — one platform goes first to work out the
kinks, the other adopts
([interview](https://www.hackingwithswift.com/interviews/carola-nitz-how-can-you-maintain-feature-parity-between-ios-and-android-apps)).

## Files

| Path | Role |
|---|---|
| `.github/PULL_REQUEST_TEMPLATE.md` | Where the declaration is made |
| `scripts/lint/check-parity-declaration.ts` | Validates it; blocks the PR |
| `scripts/parity/open-counterpart-issue.ts` | Opens the counterpart issue on merge |
| `scripts/lint/parity-gaps-report.ts` | Renders the derived gap report |
| `.github/workflows/parity.yml` | Validate on PR; record on push to a base branch |
| `.github/workflows/parity-report.yml` | Weekly + on-close report refresh |
| `docs/parity/OPEN-GAPS.md` | Generated snapshot — do not edit |
