# Beta test plans and the release gate

The plans in this directory are the source of truth for what a beta tester
runs. They are written as prose, in the beta-guide voice, because a tester
reads them start to finish.

| Plan | Scope |
|---|---|
| `apple-platforms-beta-test-plan.md` | iPhone, Mac, Apple Watch — packs, trips, weather, assistant, catalog, guides, offline |
| `pack-tools-beta-test-plan.md` | Ask AI, Add from Catalog, Scan Items from Photo, Start Packing — iPhone and Mac |
| `native-controls-beta-test-plan.md` | Native control surfaces |
| `revenuecat-beta-test-plan.md` | Subscription purchase and restore flows |

## Gating a release on them

Reading a plan is not the same as tracking it. To gate a release, generate
GitHub issue checklists from the plans:

```bash
bun run qa:checklist                    # print the bodies for review
bun run qa:checklist --plan pack-tools  # one plan only
bun run qa:checklist --create           # open the issues
```

That produces one issue per platform — covering every plan that touches
that platform — plus a rollup gate issue referencing them all. GitHub
renders the checkboxes natively and shows progress on the gate as
sub-issues get completed.

One issue per *platform* rather than one per plan is deliberate in both
directions. A tester works a device, not a document, so everything for the
Mac belongs on one list. But platforms stay apart: both plans say a Mac
pass tells you nothing about an iPhone pass — separate apps, separate
caches — so a single shared checklist would hide which platform a tick came
from.

Section headings carry their plan label (`### Pack tools — Ask AI`). Both
apple-platforms and pack-tools have Offline and "Things that break apps"
sections, so without the prefix the merge would fold unrelated items under
one heading.

`--create` is opt-in. Without it the script only prints, so the bodies can
be reviewed before anything reaches the tracker.

The bodies are deliberately bare: section headings and checkboxes, nothing
else. The title carries the platform, and tester guidance belongs in the
plan and in this file rather than restated on every issue.

## When a plan changes

Regenerate rather than editing issue bodies by hand. The plans get
rewritten between rounds and a hand-edited body becomes a second, quietly
diverging source of truth. Ticks already recorded on the old issue are the
one thing regeneration does not carry across, so for a mid-round change
prefer editing the affected checkbox lines in place and leaving the rest.

## Ship criteria

Every box on every checklist ticked, and every bug found either fixed or
explicitly labelled `NonReleaseBlocker`. An open `ReleaseBlocker` means no
ship regardless of the tick count.

A failing item should stay unticked *and* get a bug issue linked on its
line. An unticked box with no link reads as "not tested yet", which is a
different thing from "tested and broken".
