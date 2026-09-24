# Weather alerts

Warns a user about hazardous conditions at a place they care about — without
requiring them to open the app and go looking.

## The model in one paragraph

A user chooses which locations they want watched. Every watched location is
checked continuously in the background, not just when someone happens to open
the weather screen for it. The moment a new hazard is issued for a watched
location, the user is notified directly — a push notification lands whether
or not the app is open. Opening the app shows the same information at rest:
a bell that fills in and turns red the instant a watched location has
something active, and a screen listing every current alert with full detail.
Nothing is tracked unless the user asked for it to be, and nothing about a
resolved hazard interrupts them a second time.

## Choosing what to watch

Watching a location is always something a user does on purpose. Nothing is
inferred from where they've searched, where they're headed on a trip, or how
often they've looked something up — a location is watched because they chose
to watch it, full stop.

The natural moment to offer that choice is when it's obviously worth taking:
looking up a location that already has an active alert. At that point the
app offers to keep watching it going forward, so the user doesn't have to
remember to check back. A location with nothing going on doesn't prompt —
there's nothing yet to make the offer land, and asking anyway just trains
people to dismiss it.

A dedicated watch list holds everything a user has chosen, and any location
can be added or removed from it at any time, independent of whether it
currently has anything active.

## Getting notified

A push notification arrives the moment a new hazard is detected for a
watched location — what it is, how severe, and which location it affects.
Tapping it opens straight to that location's alert detail, not the app's
front door.

Notifications are sent once per new hazard, never repeated for one that's
still ongoing. When a hazard passes, nothing is sent — the bell and badge
simply stop reflecting it the next time the app is looked at. A user is told
once when something starts mattering and left alone afterward; they are
never told a second time that the thing they already stopped worrying about
is, in fact, over.

## What a user sees in the app

- A bell icon, wherever the weather screen is reached, that fills in and
  turns red the instant any watched location has an active alert — including
  one learned about while the app was closed, not only the location
  currently on screen.
- A dedicated Alerts screen listing every current alert for a location, each
  one expandable for full detail: what the hazard is, its severity, the
  affected area, its active window, and guidance on what to do about it.
- Alert Preferences, where a user chooses which categories of hazard they
  want to hear about — severe storms, tornado warnings, flood, fire danger,
  winter weather, extreme temperature, high winds, fog — and can turn
  notifications off entirely without losing the in-app view.

If there's nothing to report, the user sees a plain "no active alerts"
state, never an empty or confusing screen.

## Staying current

A watched location's alert state reflects what's actually true right now,
not what was true the last time someone happened to look. A hazard that
starts while the app is closed is already reflected — bell, badge, and
notification — by the time it's opened again.

## Known limitation

Alert category preferences govern which hazards a user is notified about and
which appear filled-in on the bell, but they don't change what the Alerts
screen itself lists — that screen always shows everything active for the
location, regardless of category preference. A user who has muted Fog Alerts
still sees a fog alert if they open the screen directly; they simply won't
be pushed a notification or see the bell react to it.

---

# Decisions

## ADR-001 — Alerts are pushed, not just displayed

**Decision.** A new hazard for a watched location reaches the user through a
push notification the moment it's detected, regardless of whether the app is
open. The in-app screen is a second, at-rest view of the same information,
not the primary way a user learns about it.

**Why.** An alert that only appears when someone happens to open the app
isn't a warning — it's a forecast detail they have to go looking for, and a
user asleep or away from their phone gets no benefit from it at all. The
entire value of a hazard alert is being told about it before it's convenient
to check, which by definition requires the system to reach out rather than
wait to be asked.

**Consequence.** The app now has a background obligation it didn't have
before — a watched location needs to be checked on some cadence whether or
not any user is looking at it, and the result needs to be able to reach a
device that isn't currently in the user's hand.

## ADR-002 — Watching a location is always explicit

**Decision.** A location is only ever watched because a user chose to watch
it. It is never inferred from search history, trip destinations, or
frequency of lookup.

**Why.** Automatically watching everywhere a user has searched turns one
casual lookup into a standing background commitment they never agreed to,
and a notification about a place they don't actually care about anymore
reads as noise, not a warning. Trip destinations look like an appealing
shortcut, but a trip is a plan for a future date range, not a statement that
a user wants to be woken up by every hazard between now and departure. The
watch list should only ever contain places a user actually meant to keep an
eye on.

**Consequence.** A user gets nothing proactive until they explicitly opt in
at least once, which is a real cost against a fully-automatic alternative —
made up for by the discoverability moment in ADR-003, and by the fact that
every notification a user receives is one they can trace back to a deliberate
choice, which is what keeps the channel trustworthy rather than something to
mute.

## ADR-003 — The offer to watch appears only when there's already something to watch for

**Decision.** The prompt to add a location to the watch list surfaces when a
user looks up a location that currently has an active alert. It does not
appear on ordinary lookups, and it does not wait for a repeat visit.

**Why.** An opt-in prompt converts on the strength of the moment it's asked
in, not the wording of the ask. Asked generically — on every lookup, or at
first launch — it has nothing concrete to point to and reads as a cold
permission request, which is exactly the kind of prompt users learn to
dismiss without reading. Asked at the moment a real hazard is sitting in
front of them, the value is self-evident: this place has something going on
right now, and here's how to make sure you hear about the next one too. That
is also the one moment a user is guaranteed to already care about this
specific location, rather than a moment invented by the app to justify the
ask.

**Consequence.** A user who only ever looks up locations with calm weather
is never prompted to watch anything, which is correct — there's nothing yet
to justify the offer — but does mean discoverability depends on a user
eventually hitting a location with something active.

## ADR-004 — Notify on new, stay silent on resolved

**Decision.** A push notification is sent when a new hazard is detected for
a watched location. No second notification is sent when that hazard expires
or is cancelled. The in-app bell and badge update to reflect resolution, but
nothing is pushed for it.

**Why.** The moment a hazard appears is the moment a user needs to act or at
least decide whether to. The moment it lifts carries no equivalent urgency —
nobody needs to be interrupted to be told the thing they were already
tracking is now fine. Sending a notification for both ends of every hazard's
lifecycle doubles the volume for a use case with no comparable precedent
among the alerting systems this pattern was modeled on, and a channel that
speaks twice as often for half as much reason trains users toward the exact
outcome an alerts feature can't afford — being ignored or muted.

**Consequence.** A user who wants to know a hazard has passed has to check
the app rather than be told — the bell going dark is a passive signal they
have to look at, not an active one. Accepted, because the asymmetry matches
how much each event actually deserves an interruption.

## ADR-005 — Category preferences shape what interrupts, not what's shown

**Decision.** Alert Preferences govern which hazard categories can trigger a
notification and fill in the bell. They do not filter what appears on the
Alerts screen itself — that screen always lists everything active for the
location.

**Why.** These are two different questions. "What's actually happening at
this location" is a factual list a user might deliberately go check, and
muting Fog Alerts in preferences shouldn't mean a fog alert quietly vanishes
from a screen the user opened specifically to see everything active. "What's
worth interrupting me for" is a preference about the user's own attention,
which is exactly what the notification and bell should respect. Collapsing
the two would mean a muted category disappears from the record entirely
rather than just going quiet — the difference between turning down a
volume and erasing an entry.

**Consequence.** A user has to open the Alerts screen to see a category
they've muted, since it won't announce itself through the bell or a push.
That's the intended behavior — muting is about interruption, not visibility
— but it does mean the two surfaces can disagree about how "seen" the same
alert is, worth knowing before assuming a filled-in bell and a fully caught
up Alerts screen always mean the same category set was checked.
