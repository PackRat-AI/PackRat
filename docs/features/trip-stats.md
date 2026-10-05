# Trip stats

Shows a user what their time outdoors adds up to: how often they go, how far
and how high, where, with what gear, and how they're tracking against what
they set out to do.

## The model in one paragraph

Every trip a user plans already carries dates, a place and, usually, a pack.
Once a trip is over, its log adds what actually happened: the activity,
distance and elevation gain, the route, and any summits reached. A trip
that names a trail fills most of this in already. Trip stats reads finished
trips back as a record. Planned trips count toward nothing until their end
date passes. From that record the stats screen shows lifetime totals, this
year against last year, the shape of a user's seasons, a map of everywhere
they've been, the parks, peaks and trails they've completed, the gear that
keeps coming along, and progress toward their goals. Nothing is estimated:
a number appears only when the trips behind it hold the data for it. Stats
belong to the user and sync across their devices. Nobody else sees them
unless the user shares a card.

## Logging a trip

A finished trip shows a **Trip log** prompt at the top of its detail screen.
The log holds:

- **Activity**: one or more of hiking, backpacking, camping, climbing,
  mountaineering, paddling, skiing, biking or other.
- **Distance** and **elevation gain**, in the user's distance unit.
- **Route**: the line travelled.
- **Summits reached**, picked from the named peaks near the route or the
  trip's location.

There are three ways to fill it, and they combine:

- **From the trail.** A trip that names a trail starts with that trail's
  length, elevation gain and line already filled in, as a one-way or
  out-and-back trip, whichever the user picks.
- **From a track file.** Importing a GPS track file from a watch or another
  app replaces the distance, elevation and route with what was recorded.
- **By hand.** Any field can be typed in or corrected, and a route can be
  drawn on the map.

The log can be skipped. A trip without one still counts toward everything
that needs only dates and a place.

## Totals

The top of the screen is a grid of lifetime numbers:

- **Trips** taken.
- **Distance** covered.
- **Elevation gained.**
- **Nights out**: the nights between each trip's start and end date. A day
  trip adds a trip but no nights.
- **Days outdoors**: calendar days covered by trips, with overlapping trips
  counted once.
- **Places**: distinct trip locations, with the same spot reached twice
  counted once.

Under the totals sit the records and averages: the **longest trip** by
distance and by nights, each opening its trip; the **average trip length**
in nights; and the **average trip distance**. Each figure counts only the
trips that hold its data, so ten logged trips and two unlogged ones produce
a distance average over the ten.

## Activities

A bar chart of trips by activity, all time, with nights and distance shown
for each bar. Tapping a bar narrows the rest of the screen to that activity
until it's cleared.

## This year

A comparison card shows trips, distance, elevation, nights out and days
outdoors so far this year next to the same stretch of last year, 1 January
to today in both. That way an early-spring check doesn't look like a
collapse. Each figure shows its change as an arrow and a number. A user in
their first year sees this year's figures alone.

## Seasons and months

A bar chart of nights out per month for the last twelve months, which can
switch to trips, distance or elevation. Below it are the user's **busiest
month** and **busiest season**, worked out from their whole history.
Seasons follow the hemisphere of the trip's location, so a December trip in
Patagonia counts as summer.

## Back on the trail

When a user takes a trip after three months or more without one, the stats
screen marks it as a comeback: "Back after 5 months". From then on it tracks
their return against their own pace before the break: trips, nights and
distance per month now, beside the same figures for the year before the gap.
The comeback card stays until they're back to their old pace, or for six
months, whichever comes first. A user can set why they were away (injury,
illness, life, season), and the card uses that word. Logging a break this
way is optional, and the reason is never shown anywhere else.

## Where you've been

A map of every finished trip. Trips with a route draw their line, and the
others show a pin. The map switches to a **heat map** that shades the areas
a user returns to most. Tapping a pin or line shows the trip's name and
dates and opens the trip. The map frames everything when it opens.

Beneath the map:

- **Countries**, and **states and provinces** for the United States, Canada
  and Australia, each with a trip count.
- **Landscapes**: trips broken down by desert, mountain, forest, coastal,
  lakes and rivers, grassland and polar. Each trip's landscape comes from
  where it is, and the user can change it.

## Parks, peaks and trails

**National Parks.** Every US National Park is listed as a checklist, with
the ones a user has visited ticked and dated. A trip counts toward a park
when its location or route falls inside the park. The counter reads "14 of
63". A user can tick a park by hand for a visit made before they used
PackRat.

**Peaks.** Every summit a user has logged, with its elevation, date and the
trip it was on, plus a running count and their highest summit. A user can
add a peak by hand for a climb made before they used PackRat.

**Trails.** Trails a user has completed end to end, with the dates. A trail
counts as completed once the user's trips, together, cover its full length,
so a trail hiked in sections completes on the last section.

**Long trails.** A user can follow a long-distance trail, such as the Pacific
Crest, Appalachian or Continental Divide. Its card shows the miles completed
against the total, a map of the trail with completed sections drawn over
it, and the trips that covered each section. Sections count from routes, so
a trip must have a route on the trail to move the bar. A section walked
twice counts once.

## Gear that comes along

For trips with a linked pack, the stats screen lists the **items packed
most often**, the top ten, each with the number of trips it went on. An
item counts once per trip, however many times it's in the pack. A second
list shows **gear not taken in the last year**: items in the user's
inventory that haven't been on a finished trip in twelve months, so they
know what's sitting in the closet.

**Pack weight over time** charts the base weight of every pack taken on a
trip, by trip date, in the user's weight unit. A line shows the trend, and
the card states the change in average base weight from last year to this
year.

## Goals

A user can hold any number of goals at once. Each goal is a card with a
progress ring, how far through its time window the user is, and whether
they're ahead of or behind pace. A met goal is marked complete and stays
visible until its window ends.

- **Annual goals** cover a year and measure trips, nights out, days
  outdoors, distance, elevation gain, summits or parks. "500 miles this year"
  is an annual distance goal. They reset on 1 January. Past years' goals and
  results stay visible in that year's view.
- **Peak targets** are a list of named peaks the user wants to summit. Each
  one ticks off when a trip logs it, and the card shows how many are left.
- **The National Parks checklist** can be set as a goal, either all of them
  or a list the user picks.
- **Long-trail completion** is the goal behind following a long trail, with
  an optional finish date.
- **Custom goals** let a user name the goal, choose what it measures from
  the same list as annual goals, set the target, and set any start and end
  date. "Ten nights out before the baby arrives" is a custom goal.

## Sharing and export

**Share a card.** Any section (totals, the year comparison, the map, a
goal, the parks checklist) can be shared as an image. The image carries
only the numbers and map on that card, and never trip names, notes or exact
locations unless the user turns those on before sharing.

**Year in review.** In December and January, the stats screen offers a
year-in-review: a short sequence of cards covering the year's totals,
busiest month, longest trip, new places, summits and goals met, ready to
share.

**Export.** A user can export every finished trip with its log as a
spreadsheet file, and every route as track files, to keep or take
elsewhere.

## Where it lives

The dashboard's stats row opens the stats screen. Stats also has its own row
in the profile. With no finished trips, the screen shows one message, that
the first finished trip starts the record, and a button to plan a trip,
instead of a grid of zeros.

## What the user controls

- **Whether stats are on.** Trip stats is opt-in: the first visit explains
  what it shows and asks the user to turn it on. Turning it off hides the
  screen and the dashboard figures, and keeps the logs.
- **Year in view.** The comparison, charts and annual goals default to the
  current year. A picker steps back through every year the user has trips
  in.
- **Goals.** Create, change or delete any goal at any time.
- **Which trips count.** A trip can be left out of stats from its detail
  screen, for a cancelled trip that was never deleted or a trip planned for
  someone else. Excluded trips stay in the trip list, marked as such.
- **Units.** Distance, elevation and weight follow the user's existing unit
  preferences.

The logs, goals, exclusions and the on/off choice belong to the user's
account, so they are the same on every device they sign in on.

## What this feature does not do

- No live GPS recording. Routes come from the trail, a track file or the
  user's own drawing, not from tracking a hike as it happens.
- No public profiles, leaderboards or comparison with other users. Stats are
  only ever seen by others through a card the user chose to share.
- No checklists beyond US National Parks. Other park systems, peak lists and
  trail lists aren't pre-built.
