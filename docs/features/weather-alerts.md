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

Any location can be watched at any time, whether or not anything is
currently happening there. The forecast screen carries a watch control for
whatever location is on screen, always — a user who wants to keep an eye on
a trailhead in calm weather can do that in one tap, without waiting for a
hazard to appear first. The control shows whether the location is already
watched, so it doubles as the answer to "am I watching this?" and the way
to stop.

When a location does have something active, the alert section in the
forecast repeats the offer in the moment it means the most: the user is
looking at a real hazard, and watching is how they hear about the next one.
That offer only appears while the location isn't already watched — once it
is, the section says so quietly instead, so the user is never shown two
live ways to do the same thing.

A dedicated watch list holds everything a user has chosen, and any location
can be added or removed from it there too.

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

- An alert section inside the forecast itself, shown whenever the location
  on screen has something active. It sits between the current conditions and
  the 10-day outlook — above the rest of the forecast because a hazard
  outranks it, inside the forecast because it is part of what the forecast
  for this place says. It cannot be dismissed, and it carries the offer to
  watch the location while the location isn't watched yet.
- A watch control on the forecast screen for the location on screen,
  present whether or not anything is active, showing whether that location
  is currently watched.
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

> **Superseded by ADR-006.** The reasoning below about *where the offer lands
> hardest* still holds and still drives the call to action inside the alert
> section. What it got wrong was treating that moment as the *only* way in,
> which made watching a calm location impossible.

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

## ADR-006 — Watching is always available; the alert lives inside the forecast

**Decision.** Two changes that only make sense together. Watching a location
is available on any location at any time, through a persistent control on the
forecast screen, rather than only through a prompt conditioned on an active
alert. And an active alert is rendered as a non-dismissible section within the
forecast content, rather than as a dismissible banner laid over it. The
in-section watch call to action survives, but only while the location isn't
already watched.

**Why.** ADR-003 was right that the moment a hazard is on screen is when the
offer converts, and wrong that it should therefore be the only moment the
offer exists. Gating the entire capability on that moment means a user who
wants to watch a trailhead before a trip — exactly the user this feature is
for — simply cannot, and has to wait for the weather to turn to be given a
control that should have been there all along. Conditioning *discovery* on a
high-intent moment is good practice; conditioning *access* on it is a
capability gap wearing the costume of a conversion tactic.

The banner had a matching problem. A dismissible overlay is the right
treatment for a suggestion the user can decline, which is what the banner
originally was, but it is the wrong treatment for a hazard: dismissible
alerts are the ones users miss, because dismissal is cheap and the cost of
being wrong is asymmetric. Making the alert a section of the forecast also
tells the truth about what it is — not an interruption over the forecast, but
the most important thing the forecast currently has to say. Severity is
carried on the leading edge of each card rather than by flooding it, which
keeps several simultaneous alerts readable without turning the screen into an
alarm.

Keeping both affordances live at once would have been the obvious failure
mode — an ambient toolbar control and an in-section button that do the same
thing read as a nag. Hence the split: the toolbar control is always present
and always the stateful indicator, while the in-section call to action is
only ever actionable when it adds something the toolbar doesn't, and
collapses to a confirmation the moment it doesn't.

**Consequence.** Discoverability of watching no longer depends on a user
eventually hitting an alerting location, which retires the cost ADR-002 and
ADR-003 both accepted. In exchange, the watch control is now visible to users
who will never use it, which is the ordinary price of an ambient affordance.
The alert section also means a user can no longer clear a hazard off their
screen — intended, but it does mean a long-running alert is permanently
present in the forecast for as long as it is active, so the collapsed card
has to stay compact enough not to bury the 10-day outlook behind it.

---

## ADR-007 — The location list and a location's forecast are separate screens

**Decision.** Weather is two screens. The first is a list: every saved
location as a card showing its conditions, local time, temperature range and
any active alert. The second is one location's forecast — hero, alert
section, hourly strip, 10-day outlook, condition detail. The per-location
watch control lives in the forecast screen's navigation bar. The list
screen's navigation bar carries a single overflow menu holding the
list-level actions: Edit List, Notifications, Watch List, and units.

**Why.** The previous screen was the list, the search, *and* the forecast for
whichever location happened to be selected. That is a structural problem, not
a layout one: a control that acts on one location had nowhere to sit except a
navigation bar belonging to every saved location at once. The symptom was
four competing toolbar items, two of them bells meaning different things —
one opening the alerts sheet, one toggling whether this location is watched.
No arrangement of those four fixes it, because the ambiguity is in the
screen's scope rather than in the buttons.

Apple's guidance is that a navigation bar should carry only actions relating
to the content currently on screen. A single screen showing all locations and
one location simultaneously cannot satisfy that, so the fix is to give a
location its own screen. Once there is exactly one location on screen, the
watch toggle in its navigation bar is unambiguous, and the list's bar is free
to carry only what applies to the list.

ADR-006's reasoning survives this intact — watching is still always
available, still stateful, still not gated on a hazard being in progress, and
the alert is still a non-dismissible section inside the forecast. What
changes is only *which* navigation bar the ambient control belongs to. The
in-section call to action keeps the same relationship to it.

Saved locations and watched locations stay separate concepts. Merging them
would have made the list simpler and closer to Apple's, but it would also
make watching implicit — saving a place you wanted to look at once would
silently opt you into push notifications for it, which is exactly what
ADR-002 rules out. The card shows a bell when a location is watched, so the
list still answers "what am I watching?" at a glance without conflating the
two.

**Consequence.** There is one more screen to navigate, so a user checking a
single location's forecast now taps once more than before. That is the cost
of the list being a real list; it is also what makes a second, third and
fourth saved location legible, which the old horizontal chip row handled
poorly. The forecast screen renders over a condition-driven sky gradient
rather than the system background, so everything drawn on it — including the
shared alert section — has to hold contrast against colour rather than
against a neutral surface.
