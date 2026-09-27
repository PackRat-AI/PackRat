# Weather alerts

Warns a user about hazardous conditions at a place they care about — without
requiring them to open the app and go looking.

## The model in one paragraph

A user saves the locations they care about, and chooses which of those they
want watched. Every watched location is checked continuously in the
background, not just when someone happens to open the weather screen for it.
The moment a new hazard is issued for a watched location, the user is
notified directly — a push notification lands whether or not the app is
open, and tapping it opens that location's forecast. Opening the app shows
the same information at rest: a red marker on the dashboard's weather tile
and on the location's card in the list, and the alert itself inside that
location's forecast. Nothing is tracked unless the user asked for it to be,
and nothing about a resolved hazard interrupts them a second time.

## Saving and watching

These are two different commitments, and the app keeps them in order.

**Saving** a location puts it in the weather list. It is how a user says
"show me this place" — no background work, no notifications. A location is
saved from the `+` on a search result, or from the `+` on the forecast of a
location being previewed.

**Watching** a saved location subscribes it to background polling and push.
Watching is always something a user does on purpose: nothing is inferred
from search history, trip destinations, or how often something is looked up
(ADR-002).

**A location must be saved before it can be watched** (ADR-008). The
forecast's navigation bar offers one thing at a time — `+` while the
location is unsaved, the watch bell once it is. The one path that reaches
watching from an unsaved location is the call to action inside the alert
section, and that saves the location as part of watching it rather than
refusing.

Watching does not require anything to be happening. A user who wants to keep
an eye on a trailhead in calm weather can do that in one tap. When a location
*does* have something active, the alert section repeats the offer in the
moment it means the most — the user is looking at a real hazard, and watching
is how they hear about the next one (ADR-006).

A dedicated watch list holds everything a user has chosen, and any location
can be added or removed there too.

## Getting notified

A push notification arrives the moment a new hazard is detected for a
watched location — what it is, how severe, and which location it affects.
Tapping it opens that location's forecast, where the alert section is already
on screen (ADR-009).

Notifications are sent once per new hazard, never repeated for one that's
still ongoing. When a hazard passes, nothing is sent — the markers simply
stop reflecting it the next time the app is looked at. A user is told once
when something starts mattering and left alone afterward; they are never told
a second time that the thing they already stopped worrying about is, in fact,
over.

## What a user sees in the app

**The dashboard.** The Weather tile carries a red dot while any saved
location has an alert the user hasn't opened yet. The dashboard is where a
session starts, so something that arrived while they were away is visible
before they've chosen where to go. A dot rather than a count — the number
only means something once you're on the screen itself.

**The weather list.** One card per saved location. A card whose location has
an *unread* alert carries a red bar down its leading edge and shows the alert
headline in red in place of the condition text; a watched location's bell
turns red alongside it. Once the user opens that location, the red clears
everywhere and the headline stays in white — the marker is for a hazard that
arrived since they last looked, not a permanent restatement that one exists
(ADR-010).

**A location's forecast.** Its own screen (ADR-007): sky-gradient hero,
alert section, hourly strip, 10-day range bars, condition tiles. The alert
section sits between current conditions and the 10-day outlook — above the
rest because a hazard outranks it, inside the forecast because it is part of
what the forecast for this place says. It cannot be dismissed, and each alert
expands to its area, active window and guidance. The navigation bar carries
`+` or the watch bell, per the rule above; the bell is never tinted by alert
state, because on this screen the alert is already in front of the user
(ADR-009).

**Alert Preferences**, where a user chooses which categories of hazard they
want to hear about — severe storms, tornado warnings, flood, fire danger,
winter weather, extreme temperature, high winds, fog — and can turn
notifications off entirely without losing the in-app view (ADR-005).

If there's nothing to report, the user sees the ordinary forecast with no
alert section, never an empty or confusing screen.

## Staying current

A watched location's alert state reflects what's actually true right now, not
what was true the last time someone happened to look. A hazard that starts
while the app is closed is already reflected — markers and notification — by
the time it's opened again.

## Known limitation

Alert category preferences govern which hazards a user is *notified* about.
They do not filter the alert section inside a forecast, which always shows
everything active for that location. A user who has muted Fog Alerts still
sees a fog alert on the forecast screen; they simply won't be pushed a
notification about it.

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
> which made watching a calm location impossible. ADR-008 later made that
> call to action save the location as well as watch it.

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
or is cancelled. The in-app markers update to reflect resolution, but nothing
is pushed for it.

**Why.** The moment a hazard appears is the moment a user needs to act or at
least decide whether to. The moment it lifts carries no equivalent urgency —
nobody needs to be interrupted to be told the thing they were already
tracking is now fine. Sending a notification for both ends of every hazard's
lifecycle doubles the volume for a use case with no comparable precedent
among the alerting systems this pattern was modeled on, and a channel that
speaks twice as often for half as much reason trains users toward the exact
outcome an alerts feature can't afford — being ignored or muted.

**Consequence.** A user who wants to know a hazard has passed has to check
the app rather than be told — the alert section emptying is a passive signal
they have to look at, not an active one. Accepted, because the asymmetry matches
how much each event actually deserves an interruption.

## ADR-005 — Category preferences shape what interrupts, not what's shown

**Decision.** Alert Preferences govern which hazard categories can trigger a
notification. They do not filter the alert section inside a forecast, which
always lists everything active for the location.

**Why.** These are two different questions. "What's actually happening at
this location" is a factual list a user might deliberately go check, and
muting Fog Alerts in preferences shouldn't mean a fog alert quietly vanishes
from the forecast of a place the user opened specifically to see what's going
on. "What's worth interrupting me for" is a preference about the user's own
attention, which is exactly what the notification should respect. Collapsing
the two would mean a muted category disappears from the record entirely
rather than just going quiet — the difference between turning down a
volume and erasing an entry.

**Consequence.** A user has to open the location's forecast to see a category
they've muted, since it won't announce itself through a push. That's the
intended behavior — muting is about interruption, not visibility — but it
does mean the push channel and the forecast can disagree about what the user
has been told, worth knowing before assuming a quiet notification channel
means a quiet location.

## ADR-006 — Watching is always available; the alert lives inside the forecast

> **Amended by ADR-008.** "Available on any location at any time" now means
> any *saved* location. The point this ADR was making — that access must not
> be gated on an active alert — is untouched; saving is a step the user takes
> in the same flow, not a hazard they have to wait for.

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

---

## ADR-008 — A location must be saved before it can be watched

**Decision.** The forecast's navigation bar offers `+` while a location is
unsaved and the watch bell once it is — never both, and never the bell alone.
The one path that can still reach watching from an unsaved location, the call
to action inside the alert section, saves the location as part of watching it.

**Why.** Watching an unsaved location produces a subscription with no home.
The user gets push notifications about a place that appears nowhere in their
weather list, so the only surface that could explain why they're being
notified — or let them stop — is the watch list, which they have no reason to
visit. The two commitments are also naturally ordered: "show me this place"
is a smaller thing to ask than "wake me up about this place", and an
interface that offers the larger one first invites a user to skip the
smaller.

Refusing outright would have been the wrong shape for the alert section's
call to action. A user looking at a live hazard and tapping "watch this" has
stated their intent unambiguously; answering with "save it first" is a
correctness argument the app is better off just resolving. Folding the save
into the watch keeps the invariant without making the user satisfy it.

**Consequence.** Watching is now reachable in one fewer place from a cold
start — a previewed search result has to be saved before its bell appears.
That is the intended trade, and it costs a tap in exactly the flow where the
user was already deciding whether they cared about the location. It also
means the watch list can never contain a location absent from the weather
list, which is what makes the list a complete account of what the app is
doing on the user's behalf.

---

## ADR-009 — The forecast is the alert surface; there is no separate Alerts screen

**Decision.** A push tap opens the location's forecast and stops there. The
dedicated Alerts screen is removed, and the forecast's watch bell is never
tinted by alert state.

**Why.** The alert section already lists every active alert for the location,
each expandable to its area, active window and guidance — which is everything
the Alerts screen showed. Presenting a sheet on top of the forecast meant a
user who tapped a notification got the same hazard twice, and had to dismiss
their way into the screen they'd been sent to. The second surface wasn't
adding detail; it was adding a step.

The red bell fell to the same argument. A marker earns its place by telling
the user something they don't already know, which is what makes it work on
the dashboard tile and the list card — both are surfaces where the alert
itself isn't visible. On the forecast the alert is on screen, directly below
the bell. Tinting it there adds alarm without adding information, and spends
the colour in the one place it means the least.

**Consequence.** Alert detail now has exactly one home, so there is no risk
of the two drifting. The cost is that the forecast screen carries more — a
location with several simultaneous alerts renders them all inline, above the
10-day outlook, which is why the collapsed cards have to stay compact.

---

## ADR-010 — Red marks an *unread* alert, not an active one

**Decision.** The red dot on the dashboard tile, and the red edge bar,
headline and bell on a list card, appear only while the location has an
active alert the user hasn't opened yet. Opening the location's forecast
clears them. The alert headline stays visible afterward, in white.

**Why.** An indicator that tracks *active* rather than *unread* is lit for
the entire life of the hazard — which for a winter storm or a fire watch is
days. A marker that is always on stops being read as new information and
starts being read as decoration, so the one time it genuinely matters it gets
scrolled past. Tying it to unread instead makes it mean something specific
and actionable: something arrived since you last looked.

"Unread" is tracked against the same `event|effective|…` identity the server
notifies on, so a hazard that gets re-issued with identical content doesn't
re-light the marker, while a genuinely different alert does. That also keeps
the app's badges and the push channel agreeing about what counts as new.

**Consequence.** A user who opens a location and then puts the phone down has
no standing visual reminder that a hazard is ongoing — they get the headline
on the card, in white. That is the intended reading: the alert is still
there, it just isn't news anymore. It also means the markers depend on local
state, so a user with the same account on two devices clears the marker
independently on each.
