# Offline wildlife and plant identification

What the user points a camera at, what answers them, and where that answer comes
from when there is no signal. Covers the feature as filed in issue #1816, the
behaviour that ships today, and the gap between the two.

Scope for the first build is `apps/swift`. The Expo app ships the Android half
of this feature and is the reference for the domain model; its on-device model
is a parity follow-up, not part of this pass.

## The model in one paragraph

A user in the field photographs a plant or an animal and asks what it is. The
photo is classified **on the device** against a bundled species model, and the
app answers with ranked candidate species, each carrying a confidence score and
the details that matter outdoors: habitat, distinguishing characteristics,
conservation status, and a safety rating of safe, caution, or dangerous. The
answer does not depend on a network — the model, the species database, and the
recorded history of past identifications all live on the phone, because the
places worth identifying wildlife in are the places with no bars. A server is an
enhancement, not a dependency: when one is reachable it can refine or replace the
local answer, and when it is not, the feature is undiminished in kind and only
narrower in breadth.

## What ships today

Neither platform runs a local model. Both post the image to
`POST /api/wildlife/identify` and render what comes back.

**iOS** (`WildlifeView.swift`) — one file holding the model, service, view model
and view. Auth-gated behind `GuestLimitedView`. A single best result, no
candidate list, no confidence ranking beyond one number, no persistence: the
`identifications` array is `@State` on the view model and empties when the app
does. With no network the user gets an error string.

**Android** (`apps/expo/features/wildlife/`) — the richer of the two. It has the
full domain model (`SpeciesEntry`, `IdentificationResult`,
`WildlifeIdentification`), a bundled 500-line species database, a local history
hook, and an offline fallback. But the fallback is a **keyword text match**
(`searchSpecies`) over species names, descriptions and characteristics — it
never looks at the photo. It fires only when the error is classified as a
network error, and it matches against the image's *filename* unless the user
typed a description.

So "offline identification" today means: type a guess, get species whose text
mentions your guess. That is a searchable field guide. It is not identification.

## What issue #1816 asks for

> On-device species recognition with ExecuTorch/TFLite. Camera integration,
> pre-downloaded species database. Works offline.

Four claims, and the distance from today on each:

| Filed | Today | Gap |
|---|---|---|
| On-device species recognition | Server API call | The whole inference path |
| ExecuTorch / TFLite | No local runtime | Runtime + model file |
| Camera integration | Photo picker (iOS), picker (Android) | Live capture |
| Pre-downloaded species database | Bundled on Android, absent on iOS | Port to iOS |
| Works offline | Text search on Android, error on iOS | Real offline inference |

The issue was closed as stale. Nothing in it was delivered; the server path was
built instead and the offline claim was met with a text matcher.

## Design decisions

### The local model is the primary path, not the fallback

Android's current ordering — try the server, fall back on network failure —
makes offline the degraded mode. It also means the offline path is exercised
only when something has already gone wrong, which is how it ended up being a
text matcher nobody noticed was not doing vision.

The local classifier runs first and always. It is fast, free, and private, and
it costs no round trip. The server is then consulted when reachable, and its
answer supersedes the local one when it is more confident. The user sees an
answer immediately either way, and the offline path is the one that gets
exercised on every single identification — so it cannot silently rot.

### Runtime: Core ML on iOS

`#1816` names ExecuTorch/TFLite, which is the right call for React Native on
Android. On iOS it is the wrong one: Core ML and Vision are first-party, get
Neural Engine scheduling for free, need no bundled runtime, and are what a
SwiftUI app should reach for. The filed intent — recognition runs on the
device — is preserved; the runtime that best serves it differs by platform, and
that is exactly why this repo splits iOS and Android.

Android keeps ExecuTorch/TFLite when it follows.

### Every result carries a safety rating

`dangerLevel` is not decoration. A user photographing a mushroom or a snake is
often asking a safety question in the shape of a naming question. The rating
travels with every result on every surface, including the ranked candidate list,
and a `dangerous` classification is visually distinct rather than a field among
fields.

Confidence is shown honestly alongside it. A low-confidence match on a dangerous
species is a warning to treat with caution, not an identification — the UI must
not let a 30% guess read as an answer.

### History is local and survives the session

An identification is worth keeping: it is a record of what the user saw and
where. History persists on-device, holds the photo, the ranked results, the
timestamp and the location, and is readable with no network. Android already
models this; iOS drops it on relaunch.

### Gating

Ships behind a feature flag and a `feature_access` key, both closed, per
`docs/feature-gating.md`. One line in `packages/config/src/config.ts`; the flag
name derives the access key and label.

## Domain model

Mirrored from `apps/expo/features/wildlife/types.ts` so the two platforms agree:

- **`SpeciesEntry`** — identity (`commonName`, `scientificName`, `category`),
  field guide content (`description`, `habitat`, `characteristics`, `regions`,
  `conservationStatus`, `interestingFacts`), and `dangerLevel`.
- **`IdentificationResult`** — a `SpeciesEntry` plus a normalised `confidence`
  in `[0, 1]` and a `source` marking whether the answer came from the device or
  the server. The source is surfaced, not hidden: a user is entitled to know
  whether the phone or the cloud answered.
- **`WildlifeIdentification`** — one saved event: the image, the ranked results,
  timestamp, optional notes and location.

## Open questions

- **Model provenance.** Which pre-trained species classifier, under what
  licence, covering which taxa and regions. A model that knows 200 North
  American species is a different product from one that knows 10,000 globally.
- **Delivery.** Bundled in the app (bigger download, works on first launch) or
  fetched on first use (smaller install, needs one online moment before the
  offline feature works). The issue says "pre-downloaded", which leans to the
  second.
- **Coverage honesty.** What the app says when the subject is outside the
  model's taxa. "No match" and "not in my database" are different messages and
  the second is the true one.

## Related

- Issue #1816 — the original filing
- `docs/feature-gating.md` — flag and access contract
- `docs/features/offline-sync.md` — the app's broader offline posture
