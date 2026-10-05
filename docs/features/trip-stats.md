# Trip stats

Shows a user what their time outdoors adds up to: how often they go, for how
long, where, and with what gear.

## The model in one paragraph

Every trip a user plans already carries dates, a place and, usually, a pack.
Trip stats reads those trips back as a record. A trip counts once its end
date has passed; planned trips count toward nothing until they happen. From
that record the stats screen shows lifetime totals, this year against last
year, the shape of a user's seasons, a map of everywhere they've been, and
the gear that keeps coming along. Nothing has to be logged twice and nothing
is estimated: a number appears only when the trips behind it hold the data
for it. Stats are private to the user, are worked out from the trips on
their device, and are there offline.

## Totals

The top of the screen is four numbers, all lifetime:

- **Trips** taken.
- **Nights out** — the nights between each trip's start and end date, added
  up. A day trip adds a trip but no nights.
- **Days outdoors** — calendar days covered by trips, with overlapping trips
  counted once.
- **Places** — distinct trip locations, with the same spot reached twice
  counted once.

Under the totals sit the records: the **longest trip** by nights, which
opens that trip, and the **average trip length**. A trip without dates
counts toward Trips and Places and nothing else; a trip without a location
counts toward everything except Places and the map.

## This year

A single comparison card: trips, nights out and days outdoors so far this
year beside the same figures for the same stretch of last year — 1 January
to today in both — so an early-spring check doesn't read as a collapse. Each
figure shows its change as an arrow and a number. A user in their first year
sees this year's figures alone, with no comparison row.

## Seasons and months

A bar chart of nights out per month across the last twelve months, with the
current month at the trailing edge. Below it, the user's **busiest month**
and **busiest season**, worked out from their whole history, not just the
last year. Seasons follow the hemisphere of the trip's location, so a
December trip in Patagonia counts as summer.

## Where you've been

A map with a pin for every past trip that has a location. Tapping a pin
shows the trip's name and dates and opens the trip. Beneath the map, the
**countries** and, for the United States, Canada and Australia, the
**states and provinces** a user has visited, each with a trip count. The map
frames every pin when it opens.

## Gear that comes along

For trips with a linked pack, the stats screen lists the **items packed
most often** — the top ten, each with the number of trips it went on. An
item counts once per trip however many times it's in the pack. A second list
shows **gear not taken in the last year**: items in the user's inventory
that haven't been on a past trip in twelve months, so they know what's
sitting in the closet.

Pack weight is tracked alongside: the **average base weight** of packs taken
on trips this year against last year, in the user's chosen weight unit.

## Annual goal

A user can set one goal for the year: a number of trips, or a number of
nights out. The goal card shows progress as a ring, how far along the year
is, and whether they're ahead of or behind pace. Meeting the goal marks the
card complete for the rest of the year. Goals reset on 1 January; the past
year's goal and result stay visible in that year's view.

## Where it lives

The dashboard's stats row opens the stats screen. Stats also has its own row
in the profile. With no past trips, the screen shows one message — the first
finished trip starts the record — and a button to plan one, instead of a
grid of zeros.

## What the user controls

- **Year in view.** The comparison, chart and goal default to the current
  year; a picker steps back through every year the user has trips in.
- **Annual goal.** Set, change or clear it at any time. Clearing it removes
  the card.
- **Which trips count.** A trip can be left out of stats from its detail
  screen — for a cancelled trip that was never deleted, or a trip planned
  for someone else. Excluded trips stay in the trip list, marked as such.
- **Units.** Weights follow the user's existing unit preference.

The goal and the trips a user leaves out belong to their account, so they
are the same on every device they sign in on.

## What this feature does not do

- No distance, elevation gain or route-based figures. Trips don't record a
  track, and this feature doesn't guess one from a pin.
- No heat maps, region-type breakdowns (desert, coastal, alpine) or terrain
  classification.
- No checklists: National Parks, peak bagging, trail systems or long-trail
  sections.
- No custom goals beyond the single annual trips-or-nights goal.
- No injury or break tracking.
- No export, sharing or public stats. Stats are never shown to other users.
