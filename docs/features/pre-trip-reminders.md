# Pre-trip reminders

Gets a user out the door ready. In the days before a trip, PackRat tells them
what still needs doing — pack, charge, check the weather and the trail — so
the first time they think about any of it isn't the morning they leave.

## The model in one paragraph

A trip with a start date has a countdown, and PackRat walks the user down it.
At a few fixed moments before departure a reminder lands on their phone, and
each one is about the trip it names: how much of its pack is still unpacked,
which of its gear needs a charge, what the weather is doing at its
destination, what hikers are reporting about its trail. Tapping a reminder
opens that trip, where the same picture is waiting as a readiness summary.
Reminders only exist for trips that have a date, they stop the moment the
trip starts, and a user who has already done the thing a reminder is about
isn't told to do it.

## The countdown

Every trip with a start date gets four reminders, at moments that match how
people actually prepare:

| When | What it says |
|---|---|
| **7 days before** | The trip is next week — review the pack. |
| **3 days before** | Time to start packing, with how much of the pack is done. |
| **The evening before** | Last check: what's still unpacked, and what needs charging tonight. |
| **The morning of** | Have a great trip — with the one thing most worth not forgetting. |

Each reminder is written from the state of the trip at the moment it's sent,
not when the trip was created. A pack that is fully packed by day three gets
"You're all packed" instead of "start packing", and the evening-before
reminder lists only what is genuinely still outstanding.

A trip planned at short notice gets only the reminders still ahead of it. A
trip created two days out starts at the evening-before reminder; nothing is
sent late to make up for the ones it missed.

## Packing

A trip's linked pack is what the packing reminders are about. Progress is the
share of that pack's items checked off in packing mode, so the reminders and
the checklist the user is working through always agree.

When there is something left, the reminder names it. Not "you have 14 items
left" but "Still unpacked: sleeping bag, stove, headlamp and 11 more" —
leading with the items that matter most on a trip, shelter, sleep and water
ahead of a spare bandana.

A trip with no linked pack still gets its countdown, and the packing reminder
becomes an invitation to link one.

## Charging

Gear that runs on a battery — phone, headlamp, GPS, power bank, camera — is
recognised in the trip's pack. The evening before departure, the reminder
lists that gear by name so it all goes on the charger the same night.

When the trip runs longer than a couple of nights, the reminder suggests
bringing a way to recharge in the field, unless the pack already has one.

## Conditions at the destination

A trip with a destination is checked against the weather and trail
conditions PackRat already knows about for that place.

- **Weather.** The countdown reminders carry the forecast for the trip's
  dates once one exists, and say what it means for the pack — "Lows near
  freezing — pack your warm layers." If a hazard is issued for the
  destination while the trip is upcoming, the user hears about it the same
  way a watched weather location does, without having to have watched it.
- **Trail conditions.** If a hiker reports on the trip's trail in the days
  before departure, the user is told, and the report is in the trip's
  readiness summary.

## Before you go

Some things that keep a trip from happening aren't gear: a park pass, a
permit, a campsite reservation, a check-in time, an ID. A trip has a short
**Before you go** list for these. PackRat suggests the common ones for the
kind of trip it is, and the user adds, removes or ticks them off. Anything
still unticked shows up in the evening-before reminder alongside the unpacked
gear.

## The readiness summary

Every reminder opens its trip, and the trip shows a readiness summary at the
top while departure is near: packing progress, gear to charge, the forecast,
any recent trail report, and the Before you go list. It is the same
information the reminders carry, in one place, for a user who would rather
check than be told. Once everything is done it says so and gets out of the
way.

## Staying in control

- **One switch for all of it.** A Trip Reminders setting turns the whole
  feature on or off.
- **Per trip.** Any single trip's reminders can be turned off from that trip,
  for the trip a user has done twenty times and doesn't need help with.
- **Changes follow the trip.** Moving a trip's dates moves its reminders.
  Deleting a trip, or removing its date, cancels them.
- **Nothing after it starts.** Once the trip's start date has passed, no more
  reminders are sent for it.

Reminders arrive whether or not the phone has signal when they're due. The
packing and charging parts never depend on a connection; the weather and
trail parts use the latest the app has.

## What this feature does not do

- No location-triggered reminders — nothing fires on arriving at a trailhead
  or passing a gear shop.
- No group readiness — reminders are about the user's own trip and pack, not
  what others in a group have packed.
- No suggestions learned from past trips. Recommendations come from the trip
  in front of the user: its pack, its length, its destination's conditions.
