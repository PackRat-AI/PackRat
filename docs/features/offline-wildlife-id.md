# Offline wildlife and plant identification

A field guide that recognises what the camera is pointed at, and answers without
a network. This document describes the feature as it is meant to work.

Scope is `apps/swift`. The Expo app ships the Android counterpart; the
platforms share the domain model and the product behaviour described here, and
differ only in inference runtime.

## The model in one paragraph

A user in the field points the camera at a plant or an animal and asks what it
is. The photo is classified **on the device**, and the app answers with ranked
candidate species — each carrying a confidence score and the things that matter
outdoors: habitat, distinguishing characteristics, conservation status, and a
safety rating of safe, caution, or dangerous. Nothing in that loop needs a
network. The recogniser, the species database, and the history of past
identifications all live on the phone, because the places worth identifying
wildlife in are the places with no signal. When a server is reachable it can
refine the answer with a larger model and a location prior; when it is not, the
feature is whole — narrower in the species it knows, but not degraded in kind.
Identification is a naming question that is usually a safety question, so the
app answers both at once and is honest about how sure it is.

## The loop

1. **Capture.** Live camera in the app, or a photo from the library. The camera
   is the primary entry point — this is a thing you do while standing in front
   of the subject.
2. **Recognise.** The on-device classifier runs immediately against the active
   species packs. No spinner waiting on a server, no failure mode where a
   subject walks away while a request times out.
3. **Rank.** Candidates come back ordered by confidence, not as a single verdict.
   Fine-grained species identification is genuinely ambiguous — a confident top
   answer and three plausible alternatives is a more truthful answer than one
   name.
4. **Locate.** If the device has a location fix, it narrows the ranking: a
   species that does not occur where the user is standing is demoted. This
   costs nothing, needs no network, and removes most of the absurd matches.
5. **Answer.** The result screen leads with the name and the safety rating,
   then the field-guide detail. Every result says whether the phone or the
   server produced it.
6. **Keep.** The identification is saved on-device with the photo, the ranked
   results, the timestamp and the location, and is readable later with no
   network.

## Design decisions

### On-device is the primary path, not a fallback

The local classifier runs first and always, on every identification. The server
is consulted afterwards when reachable, and supersedes the local answer only
when it is meaningfully more confident.

Ordering it the other way — server first, local on failure — makes the offline
path the degraded mode, and a path that only runs when something has already
gone wrong is a path nobody notices has rotted. Running local-first means the
offline experience is exercised by every user on every use, so it cannot quietly
stop working. It is also faster, free, and private.

### Runtime: Core ML and Vision on iOS

Recognition runs through Core ML with Vision handling capture and preprocessing.
First-party, Neural Engine scheduling for free, no bundled third-party runtime,
and the natural fit for a SwiftUI app. Android reaches for ExecuTorch/TFLite for
the same reason on its side. The requirement is that inference is local; the
runtime that best serves it is a per-platform choice, which is precisely why
this repo splits iOS and Android.

### Model: a distilled mobile backbone on openly-licensed biodiversity data

The recogniser is a MobileNetV4-class image classifier, distilled from a
biodiversity foundation model and trained only on openly-licensed observation
imagery, quantized for on-device inference.

Three constraints drove this:

- **Licensing has to survive a commercial app.** iNaturalist's full
  classification model is deliberately not published — their
  [public repo](https://github.com/inaturalist/model-files) offers only a ~500-taxa
  "small" model, because the full one is trained partly on all-rights-reserved
  user photos. [BioCLIP 2](https://imageomics.github.io/bioclip-2/) is the
  clean alternative: MIT weights over the CC0 TreeOfLife-200M dataset, explicitly
  redistributable and commercially usable. Training data is restricted to CC0 and
  CC-BY imagery — **CC-BY-NC observation photos are excluded**, since a paid app
  is a commercial use.
- **It has to fit on a phone.** BioCLIP 2 itself is a ViT-L — excellent, and far
  too large to ship. It serves as the teacher, not the shipped artifact. A
  distilled MobileNetV4 backbone lands near 34 MB unquantized and around 5 MB at
  4–6 bit palettization, which is the difference between a feature that ships
  and one that doesn't.
- **Accuracy has to be honest about its own limits.** A model that knows 2,000
  species is a real product; one that claims 100,000 on a phone is not. Coverage
  is stated plainly rather than implied.

### Delivery: a small bundled core, regional packs on demand

The app ships with a **core pack** — the few hundred species a user is most
likely to meet, weighted toward dangerous and commonly-confused ones. It is in
the app bundle, so identification works on first launch, on the trailhead, with
no setup and no prior online moment.

Everything beyond that is a **regional pack**, downloaded on demand through
Background Assets and cached on-device. The user pulls the region they are
heading to, before they leave signal, and the app prompts for it when the
location suggests one is missing.

This follows Apple's own guidance: keep models out of the base bundle once they
grow, use on-demand delivery, and introduce it through a deliberate first-run
experience rather than a silent multi-hundred-megabyte download. The hybrid —
small default bundled, larger variants fetched — is the shipping pattern for
on-device ML apps, and it avoids both failure modes: an app too heavy to
install, and an "offline" feature that needs a network before it works once.

Packs are versioned and updated independently of app releases. Improving the
recogniser does not require shipping a binary.

### Safety is a first-class field, not a detail

`dangerLevel` travels with every result on every surface, including each entry
in the ranked candidate list, and `dangerous` is visually distinct rather than a
row among rows. A user photographing a mushroom or a snake is asking a safety
question in the grammar of a naming question.

Confidence is shown next to it and never rounded up in the user's favour. A
low-confidence match on a dangerous species is a caution, not an identification,
and the UI must not let a weak guess read as an answer. Where the stakes are
real — foraging, in particular — the app says what it does not know rather than
guessing gracefully.

### The app says when it does not know

If nothing clears the confidence floor, the answer is "no confident match", and
if the subject appears to fall outside the loaded packs, the answer names that:
*not in the species pack you have loaded* is a different and more useful message
than *no match*. One suggests the subject is unusual; the other tells the user
to download a pack.

### History is local and durable

Identifications persist on-device — photo, ranked results, timestamp, location,
optional notes — and are browsable offline. A recorded sighting is worth more
than the moment it was made in, and it is the user's data, held where they are.

### Gating

Ships behind a feature flag and a `feature_access` key, both closed, per
`docs/feature-gating.md`. One line in `packages/config/src/config.ts`; the flag
name derives the access key and label.

## Domain model

Shared across platforms; `apps/expo/features/wildlife/types.ts` is the canonical
shape.

- **`SpeciesEntry`** — identity (`commonName`, `scientificName`, `category`),
  field-guide content (`description`, `habitat`, `characteristics`, `regions`,
  `conservationStatus`, `interestingFacts`), and `dangerLevel`.
- **`IdentificationResult`** — a `SpeciesEntry`, a normalised `confidence` in
  `[0, 1]`, and a `source` recording whether the device or the server produced
  it. Surfaced to the user, not hidden: they are entitled to know who answered.
- **`WildlifeIdentification`** — one saved event: image, ranked results,
  timestamp, optional notes and location.

## Related

- Issue #1816 — the filing this feature implements
- `docs/feature-gating.md` — flag and access contract
- `docs/features/offline-sync.md` — the app's broader offline posture

Sources for the model and delivery decisions:
[iNaturalist model-files](https://github.com/inaturalist/model-files) ·
[BioCLIP 2](https://imageomics.github.io/bioclip-2/) ·
[imageomics/bioclip-2 weights](https://huggingface.co/imageomics/bioclip-2) ·
[Reducing the Size of Your Core ML App](https://developer.apple.com/documentation/coreml/reducing-the-size-of-your-core-ml-app) ·
[Integrate on-device AI models using Core AI (WWDC26)](https://developer.apple.com/videos/play/wwdc2026/326/)
