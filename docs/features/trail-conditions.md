# Trail conditions

What hikers are finding on a trail right now, put in front of the person about
to walk it.

## The model in one paragraph

A trail condition report is one hiker's account of one trail on one day: how
it is overall, what the ground is like, what hazards are out there, a few
words and a few photos. It is an attribute of a place, not an item in a news
feed, so every report is fastened to a trail the reporter picked from
PackRat's trails, never to a name they typed. That is what lets PackRat answer
the question a hiker actually has, "what is the trail I'm walking on Saturday
like?", by showing the reports on the trip itself and telling them when a new
one lands. A report can be written on the trail with no signal, from the
watch mid-hike, or from the couch that evening, and it reaches everyone else
as soon as the phone is back online.

## A report is about a trail

The reporter chooses the trail the same way they choose a place anywhere else
in PackRat: type a few letters, pick from the matching trails. Trails nearest
to where they are standing come first, because the trail someone reports on
is almost always the one they are on or just left. Two people reporting on the
same trail always end up on the same trail, however each of them would have
spelled it.

When the trail isn't in PackRat, because it's unmapped or it's a stretch of
backcountry with no name, the reporter drops a pin instead and can give it a
label. A pinned report shows on the map and near trips like any other. It
just has no trail page to collect on.

Hikers can't create trails. There is no "add a trail" path.

## Conditions on a trip

A trip with a destination shows a **Trail conditions** section on its detail
screen, alongside its dates, map and pack. It is part of the trip, not a
separate screen and never an alert.

| Situation | What the section shows |
|---|---|
| Recent reports | The latest few, newest first: overall condition, age, first photo, who wrote it |
| Only old reports | The same, with the age doing the warning. A "good" from three months ago is not a current "good" |
| No reports | An invitation to be the first to report |
| Trip has no destination | Nothing. There is no place to have conditions about |

A trip that names its trail shows that trail's reports. A trip with only a
destination shows reports from trails close to it, nearest first, each
labelled with its trail so the user can tell theirs from its neighbours.
Planning a trip offers the same trail picker as writing a report, so naming
the trail is one step.

A report counts as recent for two weeks. Past that it is still shown, still
dated, and labelled as older.

When a new report lands on an **upcoming or in-progress** trip, the trip and
the section carry an unread marker until it is read. A trip is upcoming for
two weeks before it starts. A finished trip gets no marker; conditions on a
hike already walked are history, not a warning.

## Looking a trail up

Searching for a trail in Trail conditions finds trails and places, not words
inside other people's notes. Choosing one opens its trail page: every report
for it, newest first, with photos. The answer to "what is it like now" is the
first thing on screen and the history is underneath. A trail nobody has
reported on yet still has a page, which invites the first report.

Reports that disagree are both shown. PackRat doesn't average them into one
verdict, because the disagreement is useful to the reader.

From a trail page the user can write a report about it or start a trip to it.

## The recent feed

A reverse-chronological list of the latest reports from everyone, reachable
from the dashboard and the sidebar. It is for browsing, for the hiker with no particular trail
in mind. Searching from the feed opens a trail page rather than filtering the
list.

## Writing a report

Any signed-in hiker can write a report. It asks for:

- **The trail**, picked, not typed. Required.
- **Overall condition**: excellent, good, fair or poor.
- **Surface**: dry, muddy, snow, ice and so on.
- **Hazards**: downed trees, high water, washouts, rockfall, wildlife, ice.
- **Photos**, up to five, from the camera or the library.
- **Notes**, free text.

Only the trail is required. The rest is whatever the hiker noticed.

Where it's written from changes how much PackRat fills in:

- **From a trail page**, the trail is already set.
- **From a trip**, the trip's trail is filled in and the report is linked to
  the trip.
- **From the watch**, the hiker taps a condition and can dictate a short note.
  The watch records where they are. The draft waits on the phone, which
  suggests the trails nearest that spot, so finishing it means confirming a
  suggestion, not searching. A watch draft never interrupts what the phone is
  showing.

The report keeps where and when it was written, so readers see it was filed
from the trail and not from memory. Photos are stripped of their own location
before they are shared.

### No signal

A report written offline, photos included, is saved on the device and sent
when a connection returns, with its original time. The hiker sees it in their
own list straight away, marked as waiting to send. Reports already loaded stay
readable offline.

### After submitting

A report is a dated observation, so it can't be edited afterwards; that would
quietly rewrite what someone saw on a day that's over. Its author can delete
it.

## Being told without asking

When a new report lands on the trail of someone's upcoming or in-progress trip,
or on a trail close to its destination when the trip names none, they get a notification naming the trip and the condition.
Tapping it opens the trip. One trip gets at most one of these a day, and a
report they've already read in the app doesn't notify them.

Nothing else notifies. A hiker with no upcoming trips hears nothing, however
busy the feed is.

## Keeping it honest

Any report can be **flagged** as wrong, offensive or spam from its overflow
menu. A flagged report is hidden from the person who flagged it immediately
and goes to PackRat for review. A hiker can also **block** another hiker, after
which they never see that hiker's reports.

## Who sees what

- **Signed in**: everything above.
- **Guest**: Trail conditions explains what it offers and asks them to sign
  in, rather than showing an empty list. It says plainly that their packs and
  trips keep working without an account.
- **Offline**: previously loaded reports and photos stay readable; writing
  still works and sends later.

## What the user controls

- Which trail a report is about, and everything else in it.
- Deleting their own reports.
- Whether trail-condition notifications are on, from notification settings.
- Flagging reports and blocking hikers.

## What this feature does not do

- **Trust scores.** There is no reputation number, no ranking of reporters,
  and no "verified hiker" badge. A report shows who wrote it and when, and the
  reader judges.
- **Averaging.** No single "current condition" computed from several reports.
- **Hiker-created trails.** Unmapped places get a pin, not a new trail.
- **Editing a report** after it's submitted.
- **Notifications for anything but your trips.** Not for trails nearby,
  popular trails, or trails you reported on before, and no "follow this
  trail" option. Planning a trip is how you say you care about a trail.
- **Notifications for pinned reports.** A pin has no trail to be attached to a
  trip by, so it shows on the map and near trips but never notifies.
- **Video**, and photos beyond five per report.
- **Comments or replies** on reports.
