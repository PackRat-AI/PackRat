# Trail conditions

What hikers know about a trail right now, and how PackRat gets it in front of
the person about to walk it. Covers where conditions appear, how they are found,
who may write one, and what the app does on its own when something changes.

Scope is `apps/swift` — iPhone, iPad, Mac and the paired watch. The Expo app
ships Android and has its own surface, which this document does not describe.

## The model in one paragraph

A trail condition report is one hiker's account of one trail on one day. It is
not news and it is not a feed — it is an **attribute of a place**, and the place
is the thing a user is thinking about. So every report is read in the context of
a location: the destination of a trip they are about to take, or a trail they
looked up on purpose. A chronological list of everyone's recent reports still
exists, but it is a way to stumble on something, not the way to find out whether
the trail you are hiking on Saturday is passable. When conditions change
somewhere a user is actually going, the app says so without being asked.

## The three ways in

Ordered by how much the user already knows about what they want.

**1. A trip they have planned.** They know exactly where they are going. The
trip already carries the destination, so PackRat can answer the question before
it is asked: conditions for that location appear on the trip itself.

**2. A trail they are considering.** They have a name in mind but no trip yet.
They search for it and read what is there.

**3. Nothing in particular.** They are browsing. The recent feed gives them
something to read and, occasionally, a reason to change a plan.

Most of the product effort belongs to the first two. The third is the one the
app shipped with, and it is the least useful of the three: a stranger's report
on a trail 800 miles away is trivia.

## Conditions on a trip

A trip with a location shows an inline **conditions section** on its detail
screen. It is part of the trip, in the same column as the dates, the map and the
linked pack — not a separate destination to navigate to, and never an alert,
a modal, or anything that has to be dismissed. See ADR-002.

The section has four states, and each one says something different:

| State | What it shows |
|---|---|
| Recent reports exist | The most recent few, newest first, with condition, age and who wrote it |
| Reports exist but are stale | The same, with the age carrying the warning — a three-month-old "good" is not a current "good" |
| No reports for this location | An invitation to be the first, which is a prompt to write rather than an apology |
| Trip has no location | Nothing at all — there is no place to have conditions about |

The last row matters more than it looks. A trip with no destination is a real
and common state in PackRat, and showing an empty conditions section on one
would be reporting the absence of data that was never possible to have.

When a report arrives for a trip that is **upcoming or in progress**, the
section earns emphasis — an unread marker on the trip and on the section itself,
cleared by reading it. A trip that has finished gets no emphasis at all;
conditions on a hike already walked are a matter of record, not a warning.

### What "upcoming or active" means

Upcoming and active trips are the only ones that get proactive treatment,
because they are the only ones where a condition change can still change a
decision. A trip is **active** between its start and end dates and **upcoming**
within a window before it starts. Past trips fall out of scope entirely.

The window is deliberately generous rather than tight — the decisions conditions
affect (whether to go, what to carry, which route) are made in the days before a
trip, not the hour before. See ADR-004.

## Looking a trail up

Search is the deliberate path: the user names a place and PackRat answers for
that place. It resolves **destinations and trails**, not report text. Someone
typing "Cascade Pass" is asking about Cascade Pass, and a fuzzy match against
the notes field of unrelated reports is noise dressed up as results.

A trail's page collects every report for that trail, newest first, so the answer
to "what is it like right now" is the first thing on screen and the history sits
under it. Two reports a day apart that disagree are both shown; the app does not
average them into a single verdict, because the disagreement is itself
information the reader can use.

From that page the user can start a trip to the place, or write a report about
it.

## The recent feed

Still there, still a flat reverse-chronological list of reports across all
trails, reachable from the dashboard tile and the sidebar. Its job has changed:
it is the browse surface, not the front door. It is where someone with no
specific question goes to see what other people are finding.

It keeps its search field, which now does what search does everywhere —
resolves places — so typing a trail name in the feed lands on that trail's page
rather than filtering the list in place.

## Writing a report

Anyone signed in can report on a trail they have been to. The form asks for the
trail, an overall condition (excellent, good, fair, poor), the surface, any
hazards, and free-text notes. Only the trail name is required; everything else
is a hiker adding what they noticed.

Reports can be written from three places, and the difference between them is how
much PackRat can fill in:

- **From a trail's page** — the trail is already known, so the form opens with
  it filled.
- **From a trip** — the trip's destination fills the trail, and the report is
  linked to the trip.
- **From the watch**, mid-hike, where typing a trail name is not realistic. The
  watch captures the condition and a short note; the phone holds it as a draft
  until the user adds a name and submits. A draft that syncs in never interrupts
  whatever the phone is showing — it waits in a list.

Writes work offline. A report submitted with no connection is saved on the
device and sent when one returns, like every other write in the app. There is
no update path for a report once it is submitted; a report is a timestamped
observation, and editing one silently rewrites what someone saw on a day that
has passed. It can be deleted by its author.

## Being told without asking

When a new report lands on a location attached to someone's upcoming or active
trip, they get a notification. This is the only proactive surface, and it is
narrow on purpose.

It fires on **new information about a place you are going**, which is a
different and much smaller set than "new reports". A user with two upcoming
trips hears about two places. A user with none hears nothing, no matter how much
activity there is in the feed.

Notifications require the same permission every other PackRat notification does
and are governed by it. Tapping one opens the trip it concerns — not the report
in isolation, because the reason the report matters is the trip. A report
already read in the app does not notify twice.

What it deliberately does **not** do: notify about trails a user has reported on
before, trails near them, or popular trails. Each of those is a plausible reason
to send someone a push and none of them is tied to a decision the user is about
to make. See ADR-005.

## Who sees what

**Signed in** — everything above.

**A guest** can read nothing. Trail conditions are other people's accounts, held
in an account-scoped system, so the surface explains what it is and offers
sign-in rather than showing an empty list. Their packs and trips keep working
untouched, which the copy says explicitly, because the common fear at a sign-in
prompt is that declining costs them what they already have.

**Offline**, previously-loaded reports stay readable and new ones cannot be
fetched. Writing still works, per the outbox.

## Known gaps

Stated rather than papered over.

1. **A trail is identified by its name as typed.** There is no canonical trail
   record, so "Cascade Pass" and "Cascade Pass Trail" are two trails to the
   system and neither sees the other's reports. This is the single largest
   constraint on everything above — trip matching, the trail page, and
   notifications all rest on it.
2. **A trip's location is a coordinate and a display name, not a trail.** Tying
   a trip to reports means matching on that name, so a trip named for a
   trailhead and a report named for the trail do not meet.
3. **No photos.** The data model carries a photo array and nothing writes to it.
   For conditions specifically — a washed-out crossing, a snowline — a photo
   carries more than the four fields do.
4. **No report freshness policy.** Nothing expires, so a trail whose last report
   is from two winters ago shows that report as its current condition with only
   the age to signal otherwise.
5. **No moderation.** Any signed-in user can post anything to any trail name,
   and there is no report-this-report path, no rate limit, and no trust signal
   beyond the author.

---

# Decisions

## ADR-001 — Conditions are an attribute of a place, not a feed

**Decision.** The primary experience is location-first: conditions are found by
going to a place, either through a trip or through search. The chronological
cross-trail feed is demoted to a browse surface.

**Why.** The feed was built first and it answers a question almost nobody has.
"What did people report recently, anywhere" is interesting for about thirty
seconds; "is the trail I am hiking Saturday passable" is the question that
brings someone to the screen, and the feed answers it only by accident — by
having the relevant report happen to be near the top. The user has to scroll
through strangers' hikes to find their own trail, which is search-by-scrolling,
which is the failure mode of every content feed applied to a lookup problem.

Conditions also behave like an attribute rather than an event. Nobody wants a
stream of weather observations; they want the weather where they are going.
Trail conditions are the same shape, and the same answer applies.

**Consequence.** Two new surfaces to build and maintain — the trip section and
the trail page — and the feed keeps existing with a smaller job. It also means
the value of the feature is bounded by trail identity (gap 1): a location-first
product is only as good as its ability to decide that two reports are about the
same place, and today that decision is string equality.

## ADR-002 — The trip surface is an inline section, not an alert

**Decision.** Conditions appear inline on the trip detail screen. No alert, no
modal, no banner in the app's chrome, nothing to dismiss.

**Why.** Conditions are status. Apple's guidance is to reserve alerts for things
that need to interrupt and to present status "in a passive way so that people
can view it when they need it" — and a hiker reading a trip is already looking
at it, so there is nothing to interrupt. An alert would also fire at the worst
possible time, on open, before the user has oriented on the screen.

The same reasoning settled sync status in ADR-001 of `offline-sync.md`, and the
same failure has already been paid for once: a global banner in the app's chrome
occluded navigation controls on the detail screens (#2723). Consistency here is
not a preference — it is the second time the loud option was tried and the
inline option won.

**Consequence.** Someone who does not open the trip does not see the conditions.
That is what notifications are for, and it is why they are scoped to exactly
this case.

## ADR-003 — Search resolves places, not report text

**Decision.** Search matches destinations and trails. It does not match report
notes, hazards, or author.

**Why.** The old search filtered the loaded page of reports by substring across
name, region and notes. That produces results that are technically matches and
practically noise — a report mentioning "cascade" in its notes surfaces for
someone searching Cascade Pass, and the actual Cascade Pass reports are ranked
alongside it with no signal about which is which. Worse, it only ever searched
what had been loaded, so a trail with no report in the current page returned
nothing at all and read as "no such trail" rather than "not loaded".

A place-resolving search can also answer for a trail with **zero** reports,
which the filter fundamentally cannot. That is the state where the prompt to
write one belongs, and the old design could not reach it.

**Consequence.** "Find me reports mentioning ice" is not expressible. Acceptable:
it is a query about content in aggregate, which is a different feature from
looking up a trail, and nobody has asked for it.

## ADR-004 — Only upcoming and active trips get proactive treatment

**Decision.** Emphasis and notifications are scoped to trips that are in
progress or starting soon. Past trips show conditions with no emphasis and never
notify.

**Why.** The test for whether to interrupt someone is whether the information
can still change what they do. Before and during a trip, a condition report can
change the route, the pack, or the decision to go. After it, the same report is
a record. Notifying on a finished trip would train users that PackRat's
notifications are not worth opening, which costs the one case that matters.

**Consequence.** A trip with no dates cannot be classified and therefore gets no
proactive treatment. That is the right default — it fails toward silence — but
it means a user who plans loosely gets less from the feature than one who fills
in dates, and nothing in the app explains that connection.

**Rejected alternative — notify on every report for any location the user has
ever had a trip to.** Much larger reach, and every additional notification is
one the user did not need, which devalues the ones they did.

## ADR-005 — Notifications follow trips, not interests

**Decision.** The only trigger is a new report on a location attached to an
upcoming or active trip. Not proximity, not previously-reported trails, not
popularity, and there is no separate subscribe-to-a-trail control.

**Why.** A trip is an explicit statement of intent with a date attached, which
is the strongest possible signal that a piece of information is relevant right
now. Everything else on the list is inference. "You reported on this trail once"
does not mean you are going back; "this trail is near you" does not mean you
care; "this trail is popular" is about the trail, not the user.

Declining to add a follow-a-trail toggle is the harder call, because it is a
real user desire and it is cheap to build. It is deferred rather than refused:
a toggle introduces a second, independently-managed subscription list that the
user has to curate and prune, and the trip-derived list curates itself. The
weather feature has already been through this — its per-category alert
preference screen wrote to keys nothing read and was removed on 2026-09-27
precisely because it promised control the system did not deliver. A preference
surface should not exist before the thing it controls does.

**Consequence.** Users with no planned trips get no notifications from this
feature at all, which is correct and will still read to some of them as the
feature being broken. The in-app surfaces have to stand on their own for that
population.

## ADR-006 — Reports are immutable once submitted

**Decision.** No edit path. A report can be deleted by its author and rewritten
as a new one.

**Why.** A report is an observation stamped with a time and a place. Editing one
in place changes what a reader believes someone saw on a day that has already
passed, while the timestamp and any notification already sent stay as they were.
Delete-and-repost keeps the record honest: the new observation carries its own
time.

This also matches what the system already does — there is no update endpoint for
reports, and the outbox marks that combination terminal rather than retrying
something that cannot succeed. The decision is being written down, not
introduced.

**Consequence.** A typo means deleting and retyping. Accepted, given the
alternative is a mutable record that notifications and trip sections have
already quoted.

## ADR-007 — Guests are told what the feature is, not shown an empty list

**Decision.** A signed-out user sees an explanation and a sign-in action where
the reports would be, and the copy states that their packs and trips are
unaffected.

**Why.** The hide-versus-explain rule turns on whether the user can leave the
state. Guest is a state they can leave, so the affordance is sign-in rather than
a disabled control or a blank screen. Progressive-authentication guidance points
the same way: ask at the moment the benefit is clear, and say what the benefit
is.

Naming what stays local is load-bearing rather than reassurance. PackRat works
without an account, so a sign-in prompt appearing where content should be reads
as the app closing a door, and the specific fear is losing the packs and trips
already made. Saying so removes the reason to back out.

**Consequence.** A guest browsing the app hits a wall on this feature and not on
others, which is inconsistent-looking until the reason is read. Unavoidable:
the content genuinely belongs to accounts.
