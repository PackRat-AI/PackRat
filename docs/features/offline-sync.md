# Offline and sync

How the Swift app behaves without a network: what is saved where, how queued
writes reach the server, what the user is told about it, and every decision
behind those choices.

Scope is `apps/swift`. The Expo app has its own offline story and shares none of
this machinery.

## The model in one paragraph

Every user-authored write is applied locally first and believed immediately —
the list updates, the cache updates, and the entity's id is minted on-device. If
the server is reachable the write goes out at once and the server's copy replaces
the local one; if it is not, the write is recorded as a durable `PendingMutation`
and replayed later, oldest first, whenever connectivity returns or the app comes
to the foreground. A write therefore never fails because the network is down, and
an offline delete stays deleted. What the system does **not** do is resolve
conflicts: the last writer to reach the server wins outright.

## What is optimistic and what is authoritative

**Optimistic** — believed the instant the user acts:

- the in-memory `packs` / `trips` arrays the views render
- the SwiftData cache (`CachedPack`, `CachedTrip`)
- the entity **id**

That last one carries more weight than it appears to. Ids are client-generated
UUIDs sent to the server on create rather than assigned by it. This is what makes
replay safe — a create retried after an ambiguous failure arrives with the id the
first attempt used, so the server recognises it as the same record instead of
making a second one — and it is what lets a child item queued offline carry a
valid `parentId`, since the pack's id exists on-device before the pack exists
server-side. See `docs/design/client-uuid-split.md`.

**Authoritative** — the server's response, which replaces the optimistic copy
when one arrives. The online and offline paths in `PacksViewModel.createPack`
differ only in whose copy of the record ends up in the list; the user sees their
change either way.

**Never optimistic** — anything read-only and server-derived. Catalog search,
weather, guides, and the assistant all need a live server and show cached content
or an empty state without one. The outbox carries writes only.

## The outbox

A `PendingMutation` per write, holding the entity type, id, operation, an
optional `parentId`, and a JSON payload. Six entity types: `pack`, `packItem`,
`trip`, `packTemplate`, `packTemplateItem`, `trailConditionReport`.

Two of those are effectively migration-only. `packTemplate` and
`trailConditionReport` are enqueued from `ExpoLocalDataMigration` — content
rescued from an Expo install, including a guest's work that never reached a
server — because the Swift UI creates templates online. There is no update
endpoint for trail condition reports at all, so that combination returns
terminal immediately rather than retrying something that can never succeed.

`enqueue` refuses a create or update with no payload: such a row could only ever
fail on replay, so it is rejected at the door and logged rather than queued to
die later.

### Collapsing

Redundant work is folded before insertion, which is why the pending count tracks
outstanding intent rather than taps.

| Sequence | Result |
|---|---|
| create → delete (never synced) | Both dropped; the server is never contacted, and queued children go too |
| create → update | Folded into the create, which carries the final values |
| update → update | Collapses to the latest payload |
| update → delete | The delete supersedes; queued updates are dropped |

The cascade to children matters: if a parent create never reached the server, a
queued child create would replay against an id the server has no record of, draw
a 404, and be marked terminal — surfacing a failure for a pack the user had
already deleted.

### When it drains

`OutboxFlushModifier` triggers a flush at launch, when connectivity returns, and
when the app becomes active, plus the manual control in Settings. There is no
timer and no background task: a closed app does not sync.

`flush` no-ops while already flushing, while offline, and when there is no
session token. That last guard means a signed-out queue does not drain at all.

Replay is serial and oldest-first, so a create-then-update on one entity lands in
the order the user made it. Within a pass, a child whose parent's create has not
landed is deferred rather than sent, and inherits the parent's schedule rather
than being charged an attempt for someone else's failure.

### Retry policy

| Server response | Outcome | Spends an attempt? |
|---|---|---|
| 2xx | success — row deleted | — |
| 404 on delete | success (server already agrees) | — |
| 409 on create | success (server already has it) | — |
| 401, or `unauthorized` | retry | no |
| 408, 429 | retry | yes |
| other 4xx | terminal — marked failed | yes |
| 5xx | retry | yes |
| transport error | retry | yes |

Backoff is roughly 2s, 4s, 8s, 16s, 32s with up to 25% jitter, capped at five
attempts. The persisted `nextAttemptAt` floor exists because a flush fires on
every foreground and connectivity change — events a user can generate several
times a second — so without it a brief outage would burn the whole budget in
seconds. The jitter stops every write failed by one outage from becoming eligible
at the same instant and stampeding a server that was just struggling.

## Conflicts

**There is no conflict resolution. The last writer to reach the server wins,
unconditionally.**

The client sends a `localUpdatedAt` on create and update and the server stores
it. It is never compared against anything. The update handler builds a partial
`updateData` and issues an unconditional `UPDATE … WHERE id = ? AND userId = ?`
— no `WHERE localUpdatedAt < ?`, no version column, no ETag, no 412.

So: edit a pack on your phone while offline, edit the same pack on the web, then
reconnect, and the phone's queued update overwrites the web edit wholesale with
nothing told to either side. The column *could* support last-write-wins by
timestamp; today nothing reads it for that.

What is genuinely solved is **idempotent replay**, a different problem. Create
relies on the client-supplied id plus `onConflictDoNothing`; the server then
re-reads the row scoped by `userId` and returns the caller's own pack, so a
guessed id can neither overwrite nor disclose someone else's. Delete treats a 404
as success. Safe against duplicate and repeated writes; unsafe against genuine
concurrent editing. Single-device offline use — a phone in a canyon — is fine.

## What the user sees

Nothing, most of the time. There is no connectivity banner and no sync banner
anywhere in the app's chrome; sync state lives in **Settings → Sync**, and that
section is conditional — online with an empty queue collapses to one line. See
ADR-001.

**Signed in**, the status row reports in priority order:

| Condition | Row |
|---|---|
| failed writes exist | "N changes couldn't be synced" |
| flushing | "Syncing changes" + spinner |
| queued writes exist | "N changes waiting to sync" |
| offline, empty queue | "No connection — nothing waiting to sync" |
| online, empty queue | "Up to date" |

Plus **Last Synced** as a relative date when a value exists (ADR-003),
**Discard Unsynced Changes** when writes have failed, and **Sync Now**, disabled
while offline, while flushing, and when the queue is empty.

**A guest** gets a different section entirely — "Saved on this device only", a
"Ready to Upload" count when non-zero, and **Sign In to Sync**. No Last Synced,
no Sync Now, and no Discard. See ADR-002.

The word "offline" is deliberately not the primary message, and a bare
"Syncing…" is avoided as a standalone status. The section footer carries the
reassurance the one-line status cannot: *"Changes you make offline are saved on
this device and sent to your account automatically when you reconnect."*

## Testing offline behaviour

`NetworkMonitor` honours a `--force-offline` launch argument that pins
`isConnected = false` and ignores every path update, so the app behaves as if
there is no network while the simulator still has one:

```bash
xcrun simctl launch --console <simulator-udid> \
  com.andrewbierman.packrat --force-offline
```

This is what the UI tests use — `VisualScreenshotTests` appends it to
`app.launchArguments`. More reliable than toggling simulator networking, and
unlike airplane mode it applies only to this app. It must be passed on every
relaunch.

Unit coverage is `Tests/PackRatTests/OutboxTests.swift`, swift-testing
(`import Testing`, `@Suite`, `#expect`) rather than XCTest, covering retry
classification, backoff tiers and jitter, parent/child deferral, and enqueue
collapsing. Each test gets a clean queue from an in-memory `ModelContainer`.

```bash
cd apps/swift
xcodegen generate     # required whenever a Swift file is added or removed
xcodebuild build-for-testing -project PackRat.xcodeproj -scheme PackRat-iOS \
  -destination 'id=<simulator-udid>'
xcodebuild test-without-building -project PackRat.xcodeproj -scheme PackRat-iOS \
  -destination 'id=<simulator-udid>' -only-testing:PackRatTests
```

Pin the simulator by UDID. Skipping `xcodegen generate` after adding a test file
leaves it out of the target, and the suite silently reports zero tests executed
rather than failing.

The manual path worth walking, because it exercises queue, replay, and the status
surface together: create a pack offline, rename it, add two items, delete one,
then check Settings → Sync. The pending count is deliberately **not** five —
collapsing folded the rename into the create and cancelled the
created-then-deleted item. Reconnect, watch it return to "Up to date", then
force-quit and relaunch to confirm Last Synced survives.

## Known gaps

Documented rather than papered over; none are fixed by the work that added this
document.

1. **No conflict resolution**, as above. Concurrent edits on two devices silently
   lose one side.
2. **A signed-out queue drains nowhere and says nothing.** The guest case is
   handled, but a user who signed in, queued writes, then signed *out* falls
   through to the guest copy and is told their work is "saved on this device
   only" — true, but it loses that these writes were bound for an account they
   already have. `signOut` purges `CachedPack`/`CachedTrip` but not
   `PendingMutation`, so the writes really do survive. Distinguishing "never had
   an account" from "signed out with work pending" needs state neither
   `AuthManager` nor the outbox tracks.
3. **No background sync.** A closed app does not drain its queue.
4. **The cache prune can outrun the queue.** `writeCachePacks` deletes any cached
   pack the server's list response omitted. A pack created offline exists locally
   but not server-side, so a refresh completing before its queued create lands
   can prune it from the cache. The in-memory array still holds it and the create
   still replays, so nothing is lost — but cache and list can disagree until the
   next successful load. No test covers this.
5. **Failed writes can only be discarded, never retried.** `flush` filters on
   `!failed`, so a terminal row is never re-fetched; Sync Now does not reset it
   and nothing clears `attemptCount`. For a write that failed against a
   transiently misbehaving server, discard is the wrong remedy and the only one
   offered.

---

# Decisions

## ADR-001 — Sync status lives in Settings, not a banner

**Decision.** No connectivity or sync banner anywhere in the app's global
chrome. Sync state is reported in Settings → Sync, conditionally, and collapses
to a single line when there is nothing to say.

**Why.** Three arguments converge, and the placement one is decisive.

Offline-first apps that *do* show a persistent sync indicator put it in a
sidebar or side panel. Obsidian Sync's status icon "is located in the Status bar
on the desktop version" and "in the right sidebar on mobile and tablet"; Bear
puts cloud icons in the sidebar from 1.7 onward. **PackRat has no side drawer on
iPhone** — it is a tab-bar app — so that placement is simply unavailable to us.
A persistent top banner is not the pattern any comparable app uses, and in our
case it actively interfered with navigation: issue #2723 reported it covering the
back, add, and more buttons on Pack Detail and Trip Detail.

Bear also exposes sync state in its settings — "inside `Bear Preferences` →
`Sync`. There you can find the last sync date and the option to temporarily
disable sync on that device." That is the pattern being adopted here, so this is
an established precedent rather than an invention. Things 3 keeps its last-sync
timestamp in a settings pane too.

The other end of the spectrum sets the floor. Google's mobile apps are
offline-first and surface no sync status at all — Keep's own help documentation
describes no sync indicator and no last-synced display anywhere in the app. So
"surface nothing" is a defensible industry position, which makes Settings the
*more* informative choice rather than a compromise.

Apple's guidance agrees on the interruption question specifically. The HIG says
to avoid using an alert "merely to provide information", and for a startup
network problem to show "cached or placeholder data and a nonintrusive label"
instead; elsewhere that status works well displayed "in a passive way so that
people can view it when they need it", in contrast to a warning about possible
data loss, which "needs to interrupt". Queued-and-replaying is status. Nothing is
at risk while writes are durably queued, so nothing needs to interrupt.

**Consequence.** A user who wants to know sync state must go looking for it, and
the app will not tell them they are offline. That is the accepted cost: the
information is available where the platform's own conventions put it, and the
navigation-blocking element that had no precedent is gone. Failed writes are the
exception — genuinely actionable and data-losing — so they keep emphasis and an
action, just not in the chrome.

**Rejected alternative — reposition the banner.** A fix moving it below the
toolbar existed on another branch. It solves the occlusion and keeps the pattern
no comparable app uses; the placement problem was the symptom, not the disease.

**Rejected alternative — a toolbar status icon, mirroring Mail.** The HIG cites
Mail describing "the most recent update" in its mailbox toolbar. Viable, but
PackRat's toolbars are already dense on the detail screens where #2723 was
reported, and a second conditional element there re-creates the original
complaint in miniature.

## ADR-002 — Guests get an explanatory state, not a hidden or disabled one

**Decision.** A guest sees a Sync section, but a different one: "Saved on this
device only", a "Ready to Upload" count when non-zero, and a **Sign In to Sync**
button. No Last Synced, no Sync Now, no Discard.

**Why.** The hide-versus-disable rule turns on whether the user could *ever*
interact with the control: never available to this user (permissions, plan) →
hide; temporarily unavailable → show disabled with an explanation. Guest is
neither. It is a state the user can leave, which is what makes sign-in the right
affordance rather than a dead disabled "Sync Now".

Hiding the section outright was the obvious fix and the wrong one, because of a
fact specific to PackRat: **a guest's work is genuinely queued.**
`ExpoLocalDataMigration` enqueues guest content deliberately so that signing in
uploads it. So a guest really does have pending unsynced work — it simply has
nowhere to go yet. Hiding would conceal the true state of their data, which is
the single most important thing for them to know: it is on-device only and not
backed up. Progressive-authentication guidance points the same way: don't force
registration up front, ask at the moment it unlocks a clear benefit, and state
why. So the copy names the benefit (sync, other devices) and the risk (deleting
the app loses it) without nagging.

**Consequence.** Two branches of the same section to keep in step, and copy that
has to be honest about data loss without being alarming. The sign-in action
routes through `signOut()` to the auth gate, matching how `GuestLimitedView`
already offers sign-in to guests, so there is one path rather than a second
mechanism.

No Discard for guests is not merely a hidden button but an unreachable state:
`flush` requires a session token, so a guest's queue never drains and no
mutation can reach `failed`. A guest's failed count is structurally zero. Worth
stating, because for a guest discarding would destroy the *only* copy of their
work rather than abandoning a write the server had already refused.

## ADR-003 — `lastSyncedAt` is persisted, and absent when nothing has drained

**Decision.** The moment a queued write last reached the server is recorded to
`UserDefaults` when it happens, held in an observed stored property, and read
back at init. When no queued write has ever drained, the row is omitted rather
than reading "Never".

**Why.** Nothing recorded this before, so the row had nothing to read. It cannot
be recomputed: the outbox deletes a mutation once it lands, so a drained queue is
indistinguishable from one that was always empty. Keeping it only in memory would
reset it to "never synced" on every cold start, which tells the user less than
showing nothing.

It is stored-and-written-through rather than computed off `UserDefaults` on each
access because a computed accessor would never invalidate the views reading it,
so a completed sync would not refresh the row.

The absent-when-empty rule follows from what the value actually measures. A fresh
install and an install that has only ever written while online both have never
queued anything, and telling either that they have "never synced" would be
alarming and wrong — their data is on the server.

**Consequence.** The label reads broader than the measurement. It records when a
*queued write* last drained, not when the app last talked to the server, so a
user who is online constantly and never writes offline sees no row at all. The
narrower meaning is the one worth having — it is the fact someone with unsynced
work is asking about — but the two are easy to conflate, and a future "last
contacted the server" value would be a different thing needing a different label.

## ADR-004 — Settings ordered by frequency of use, with a manual sync that only supplements

**Decision.** Sections run Sync, Units (Weight, Weather), Notifications,
Advanced, About, Developer, Debug. **Sync Now** exists but is disabled while
offline, while flushing, and when the queue is empty.

**Why.** Apple's one explicit ordering rule is to put the controls people are
most likely to use at the top with "more advanced functionality hidden by
default". Sync leads because it is the only section reporting live state and the
reason someone opens Settings when something looks wrong. Temperature previously
sat alone under a "General" header that named nothing; it is measurement display
like weight and wind, so it moved beside them. The API-server and Clear Data
controls left Advanced for Developer below About — they are developer
affordances, and one of them signs the user out. Explanatory text moved out of
loose `Text` views in section bodies into section footers, which is what footers
are for.

Sync Now exists because a user staring at a stuck queue needs something to press.
It is deliberately not the mechanism: the HIG notes people "expect automatic
refreshes to occur periodically" and warns against making them "responsible for
initiating every update", so the automatic flush on launch, reconnect, and
foreground remains the real path.

Research contradicted two conventions assumed at the outset, and the research
won: neither "a Developer row belongs at the bottom of Settings.app" nor
"Account belongs at the top" is a citable Apple rule. Developer still goes last,
but on the frequency-of-use principle rather than an invented convention.

**Consequence.** Every existing `@AppStorage` key is unchanged, so saved
preferences survive the reshuffle — the reorganisation is presentational only. A
disabled Sync Now when the queue is empty is a control that does nothing most of
the time, accepted because the alternative is a button that appears and vanishes.
