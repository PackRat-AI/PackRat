# Offline & Sync — Swift App

How the Swift iOS/macOS app behaves without a network, and what the user is
told about it. This document is the source of truth for:

- what is **optimistic** (believed immediately) versus **authoritative**
  (what the server says)
- how the **outbox** queues writes and when it drains them
- how **conflicts** are actually resolved — which is less than you might hope
- **what the user sees, and where** (Settings, not a banner) and why
- **how to test** offline behaviour

Scope is `apps/swift`. The Expo app has its own offline story and does not
share this machinery.

> This describes what the code does today, not what it ideally would.
> §7 lists the places where the two differ.

---

## 1. The shape of it

Every user-authored write in the Swift app takes the same path:

```
                    user taps Save
                          │
                 apply to in-memory list      ← optimistic, always
                 write to SwiftData cache     ← optimistic, always
                          │
                  try the server now?
                   ┌──────┴───────┐
              yes (online)     no (guest / signed out)
                   │                  │
              request ──┐             │
                   │    │ failure     │
             success│    └────────────┤
                   │                  │
        replace local copy       enqueue PendingMutation
        with server's copy       (durable, SwiftData)
                                       │
                                 replayed later by
                                 OutboxService.flush
```

The two invariants that follow from this:

1. **A write never fails at the call site because the network is down.**
   `createPack`, `deletePack`, and the trip equivalents are declared
   non-throwing precisely so an unreachable server cannot surface as an error
   to the UI. It queues instead.
2. **The local copy always wins locally.** An optimistic delete removes the row
   and keeps it removed; the server catches up later. Nothing is resurrected
   on the next refresh — see §5 for the one case where that is not quite true.

Key files:

| File | Role |
|---|---|
| `Sources/PackRat/Services/OutboxService.swift` | Queue, collapse, replay, retry policy |
| `Sources/PackRat/Models/PendingMutation.swift` | The durable queue row + payload types |
| `Sources/PackRat/Network/NetworkMonitor.swift` | `NWPathMonitor` wrapper, `isConnected` |
| `Sources/PackRat/Shared/OutboxFlushModifier.swift` | Decides *when* to flush |
| `Sources/PackRat/Features/Preferences/SyncStatusSection.swift` | The only sync UI |
| `Features/Packs/PacksViewModel.swift`, `Features/Trips/TripsViewModel.swift` | The optimistic write sites |

---

## 2. Optimistic vs authoritative

**Optimistic** — believed the instant the user acts, before any server
round-trip:

- the in-memory `packs` / `trips` arrays the views render
- the SwiftData cache (`CachedPack`, `CachedTrip`)
- the client-generated entity **id**

That last one carries more weight than it looks. Ids are client-generated
UUIDs, sent to the server on create rather than assigned by it
(`service.createPack(id: localPack.id, …)`). This is what makes a replay safe:
a create that is retried after an ambiguous failure arrives with the id the
first attempt used, so the server can recognise it as the same record instead
of making a second one. It is also what lets a child item queued offline carry
a valid `parentId` — the pack's id exists on-device before the pack exists
server-side. See `docs/design/client-uuid-split.md`.

**Authoritative** — the server's response, which replaces the optimistic copy
when one arrives:

```swift
// PacksViewModel.createPack
pack = try await service.createPack(id: localPack.id, name: name, …)
…
packs.insert(pack, at: 0)          // server's version, not localPack
upsertCachedPack(pack, context: context)
```

On failure the same lines run with `pack = localPack` and the write is queued.
So the *only* difference between the online and offline paths is whose copy of
the record ends up in the list — the user sees their change either way.

**Never optimistic:** anything read-only and server-derived. Catalog search,
weather, guides, and the AI assistant all require a live server; offline they
show cached content or an empty state. The outbox carries writes only.

---

## 3. The outbox

### 3.1 What gets queued

A `PendingMutation` row per write, holding `entityType`, `entityId`,
`operation` (create/update/delete), an optional `parentId`, and a JSON
`payload`. Six entity types are supported: `pack`, `packItem`, `trip`,
`packTemplate`, `packTemplateItem`, `trailConditionReport`.

Two of those are effectively migration-only. `packTemplate` and
`trailConditionReport` are enqueued from `ExpoLocalDataMigration` — content
rescued from an Expo install, including a guest's work that never reached a
server — because the normal Swift UI creates templates online. There is no
update endpoint for trail condition reports at all, so
`(.trailConditionReport, .update)` returns `.terminal` immediately rather than
retrying something that can never succeed.

`enqueue` refuses a create or update with a `nil` payload. Such a row could
only ever fail on replay (`decode` throws `missingPayload`), so it is rejected
at the door and logged rather than queued to die later.

### 3.2 Collapsing

`enqueue` folds redundant work before inserting, which is why the pending
count tracks *outstanding intent* rather than taps:

| Sequence | Result |
|---|---|
| create → delete (never synced) | Both dropped. Server is never contacted; queued children are dropped too. |
| create → update | Folded into the create, which now carries the final values. One request. |
| update → update | Collapses to the latest payload. |
| update → delete | The delete supersedes; queued updates are dropped. |

The create+delete cascade to children matters: if the parent create never
reached the server, a queued child create would replay against an id the
server has no record of, draw a 404, and be marked terminal — surfacing a
failure for a pack the user already deleted.

### 3.3 When it flushes

`OutboxFlushModifier` (`.flushesPendingWrites()`, attached in `PackRatApp` to
the main window and each macOS standalone window) triggers a flush on three
events:

- **launch** — `.task`
- **connectivity returning** — `.onChange(of: isConnected)`, guarded to the
  `true` edge
- **foreground** — `.onChange(of: scenePhase)` to `.active`

Plus the manual **Sync Now** button in Settings. There is no timer and no
background task: an app that is closed does not sync.

`flush` no-ops when already flushing, when offline, or when there is no
session token. That last guard means **a signed-out user's queue does not
drain** — writes sit until sign-in, which is intended (they need an owner) but
is invisible to the user; see §7.

### 3.4 Ordering

Queued writes replay **serially, oldest `createdAt` first**, so a
create-then-update on one entity lands in the order the user made it.
Parallelism was never on the table here — it would reorder dependent writes.

Within a pass, a child whose parent's create has not yet landed is **deferred**
rather than sent (`shouldDefer`). Its `nextAttemptAt` is set to match the
parent's, so it waits on the parent's schedule instead of being charged an
attempt for someone else's failure.

### 3.5 Retry policy

Every replay outcome is classified by `OutboxService.classify`:

| Server response | Outcome | Spends an attempt? |
|---|---|---|
| 2xx | success — row deleted | — |
| 404 on **delete** | success (server already agrees) | — |
| 409 on **create** | success (server already has it) | — |
| 401, or `PackRatError.unauthorized` | retry | **no** |
| 408, 429 | retry | yes |
| other 4xx | **terminal** — marked `failed` | yes |
| 5xx | retry | yes |
| transport error | retry | yes |

Two deliberate choices in there:

- **4xx is terminal.** The payload is wrong; retrying forever would never fix
  it. The row stays in the store, marked `failed`, for the UI to surface —
  it is not dropped silently.
- **401 does not spend the retry budget.** An expired session says nothing
  about the write. Charging it would let a few foregrounds during a signed-out
  spell permanently fail a write that only needed a re-auth.

Backoff is exponential with jitter: roughly 2s, 4s, 8s, 16s, 32s, capped at
`maxAttempts` (5), plus up to 25% random. The jitter exists because a flush
fires on every foreground and every connectivity change — events a user can
generate several times a second — so without a persisted `nextAttemptAt`
floor a brief outage would burn the whole budget in seconds. The jitter
additionally stops every write failed by one outage from becoming eligible at
the same instant and stampeding a server that was just struggling.

After 5 charged attempts the row is marked `failed` and stops retrying.

---

## 4. Conflict handling — read this part carefully

**There is no conflict resolution. The last writer to reach the server wins,
unconditionally.**

The client sends a `localUpdatedAt` on create and update, and the server
stores it (`packages/api/src/routes/packs/index.ts`, and the equivalents for
templates and trail conditions). It is never compared against anything. The
update handler builds a partial `updateData` and issues an unconditional
`UPDATE … WHERE id = ? AND userId = ?`. There is no `WHERE localUpdatedAt <
?`, no version column, no ETag, no 412.

The practical consequence: edit a pack on your phone while offline, edit the
same pack on the web, then reconnect — the phone's queued update overwrites
the web edit wholesale, and nothing tells either side it happened. The
`localUpdatedAt` column is a passthrough that *could* support last-write-wins
by timestamp, but today nothing reads it for that.

What the system **does** handle correctly is **idempotent replay**, which is a
different problem and is genuinely solved:

- **Create** — the client-supplied id plus `onConflictDoNothing({ target:
  packs.id })` on the server. A replayed create is a no-op; the server then
  re-reads the row *scoped by `userId`* and returns the caller's own pack, so
  a guessed id can neither overwrite nor disclose someone else's. The client
  independently treats a 409 on create as success.
- **Delete** — a 404 on delete is treated as success. The server already
  agrees the thing is gone.

So: safe against duplicate and repeated writes; unsafe against genuine
concurrent editing on two devices. Single-device offline use, which is the
actual use case (a phone in a canyon), is fine. Multi-device concurrent
editing silently loses data.

---

## 5. What the user sees

### 5.1 Nothing, most of the time — and that is the design

There is **no connectivity banner and no sync banner** anywhere in the app's
navigation chrome. Both were removed (issue #2723: the offline banner covered
the top navigation buttons). Repositioning the banner was rejected as a fix;
the state moved to Settings instead. Three reasons, in the order they carry
weight:

1. **Offline is informational, not actionable, while writes are durably
   queued.** Apple's guidance is explicit — an alert should not be used merely
   to inform, and for a startup network problem specifically the recommendation
   is to show *cached or placeholder data and a nonintrusive label*, not an
   interruption. Nothing is at risk, so nothing needs to interrupt.
   ([HIG: Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts))
2. **Interruption should scale with significance.** Apple: status information
   works well displayed *passively so that people can view it when they need
   it*, in contrast to a warning about possible data loss, which *needs to
   interrupt*. Queued-and-replaying is status. Failed-and-will-never-send is
   closer to data loss — which is why that one case keeps emphasis and an
   action, just not in the chrome.
   ([HIG: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback))
3. **It is what mature sync apps do.** Bear renders no sync affordance at all
   when everything is synced. Things 3 and Bear both keep the authoritative
   last-sync timestamp in a preferences pane. Linear is the one holdout that
   banners — and its own docs explain why: its offline mode *"is designed as a
   failsafe and not a full-fledged feature"* and offline edits *"could
   overwrite changes from someone on your team."* That justification is about
   unresolved conflicts, and it is worth noting §4 means it partly applies to
   PackRat too.

### 5.2 Settings → Sync

`SyncStatusSection`, the first section of the Settings screen. It is
conditional: online with an empty queue collapses to one line.

**Status row**, in priority order:

| Condition | Row |
|---|---|
| `failedCount > 0` | "N changes couldn't be synced" (red triangle) |
| `isFlushing` | "Syncing changes" + spinner |
| `pendingCount > 0` | "N changes waiting to sync" (orange clock) |
| offline, empty queue | "No connection — nothing waiting to sync" |
| online, empty queue | "Up to date" (green check) |

**Last Synced** — relative date ("2 minutes ago"), shown only when a value
exists.

**Discard Unsynced Changes** — destructive, confirmed by alert, shown only
when `failedCount > 0`. Calls `discardFailed`, which deletes the failed rows.
The copy is blunt about the consequence because the consequence is permanent:
the change stays on this device and never reaches the account.

**Sync Now** — disabled while offline, while flushing, and when the queue is
empty. It exists so a user staring at a stuck queue has something to press; it
supplements the automatic flush rather than replacing it, per Apple's rule that
people *"expect automatic refreshes to occur periodically"* and must not be
*"responsible for initiating every update."*
([HIG: Progress Indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators))

**Copy notes.** The word "offline" is deliberately not used as the primary
message — non-technical readers misread it, and the useful fact is that
nothing is stranded, not the radio state. Bare "Syncing…" is also avoided as a
standalone status; Apple calls terms like *loading* and *authenticating*
vague ones that *"seldom add value."* The section footer carries the
reassurance the one-line status cannot: *"Changes you make offline are saved
on this device and sent to your account automatically when you reconnect."*

### 5.3 Elsewhere in the app

Read-only server-backed screens (catalog, weather, guides, assistant) handle
their own empty/cached states. They do not consult the outbox.

---

## 6. Testing offline behaviour

### 6.1 The force-offline flag

`NetworkMonitor` honours a `--force-offline` launch argument. It pins
`isConnected = false` and ignores every `NWPathMonitor` update, so the app
behaves as if there is no network while the simulator still has one:

```bash
xcrun simctl launch --console <simulator-udid> \
  com.andrewbierman.packrat --force-offline
```

This is the mechanism the UI tests use — `VisualScreenshotTests` appends it to
`app.launchArguments`. It is more reliable than toggling simulator networking,
and unlike airplane mode it applies only to this app. Note it must be passed
again on every relaunch.

### 6.2 Unit tests

`Tests/PackRatTests/OutboxTests.swift` — 449 lines, swift-testing
(`import Testing`, `@Suite`, `@Test`, `#expect`), not XCTest. Suites cover
retry classification, backoff tiers and jitter, parent/child deferral, and
enqueue collapsing. `ModelContainer(… isStoredInMemoryOnly: true)` gives each
test a clean queue.

Run them:

```bash
cd apps/swift
xcodegen generate     # required if any Swift file was added or removed
xcodebuild build-for-testing -project PackRat.xcodeproj -scheme PackRat-iOS \
  -destination 'id=<simulator-udid>'
xcodebuild test-without-building -project PackRat.xcodeproj -scheme PackRat-iOS \
  -destination 'id=<simulator-udid>' -only-testing:PackRatTests
```

Always pin the simulator by UDID. Skipping `xcodegen generate` after adding a
test file means the file is not in the target and the suite silently reports
zero tests executed rather than failing.

### 6.3 Manual smoke test

The path worth walking by hand, because it exercises queue, replay, and the
status surface together:

1. Launch signed in and online. Settings → Sync reads "Up to date".
2. Go offline (`--force-offline`, or airplane mode).
3. Create a pack, rename it, add two items, delete one.
4. Settings → Sync: a pending count. Note it is **not** five — collapsing
   folded the rename into the create and cancelled the created-then-deleted
   item. That is correct behaviour, not a miscount.
5. Go back online. The flush fires on the connectivity edge.
6. Settings → Sync returns to "Up to date" and **Last Synced** updates.
7. Force-quit and relaunch: Last Synced survives (it is in `UserDefaults`).

To exercise the failure path, point the app at a dev API (Settings →
Developer → API Server) and make the server reject a write with a 4xx. After
the row goes terminal, the status row turns red and **Discard Unsynced
Changes** appears.

---

## 7. Known gaps and rough edges

Documented rather than papered over. None of these are fixed by the work that
added this document.

1. **No conflict resolution at all** (§4). Concurrent edits on two devices
   silently lose one side. `localUpdatedAt` is plumbed end to end and stored
   but never compared, so last-write-wins-by-timestamp is one server-side
   `WHERE` clause away — but today it is arrival order, not timestamp order,
   that decides.
2. **A signed-out queue drains nowhere and says nothing.** `flush` requires a
   session token. Writes made before signing out sit indefinitely, and the
   Settings status row shows them as "waiting to sync" with no hint that
   signing in is the unblock. The retry policy is careful not to *fail* these
   writes (401 is attempt-free), so the queue is safe — just opaque.
3. **`lastSyncedAt` is narrower than its label suggests.** It records when a
   *queued write last drained*, not when the app last talked to the server. A
   user who has only ever written while online has never queued anything, so
   the row is absent entirely rather than claiming "never synced". Defensible,
   but "Last Synced" reads broader than what it measures.
4. **No background sync.** A closed app does not drain its queue. Writes wait
   for the next launch or foreground.
5. **The cache prune can outrun the queue.** `writeCachePacks` deletes any
   cached pack the server's list response did not include. A pack created
   offline exists locally but not server-side, so a refresh that completes
   before its queued create lands can prune it from the cache. The in-memory
   `packs` array still holds it and the queued create still replays, so the
   record is not lost — but the cache and the list can disagree until the next
   successful load. Worth a targeted test; there is not one today.
6. **Failed writes have no retry affordance, only discard.** Once a row is
   terminal the only user action is to throw it away. **Sync Now** does not
   reset `failed`, and nothing clears `attemptCount`. For a write that failed
   against a transiently-misbehaving server, discard is the wrong remedy and
   the only one offered.
