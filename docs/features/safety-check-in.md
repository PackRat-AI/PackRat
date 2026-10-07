# Safety check-in

Makes sure someone at home knows where a user went, when they should be back,
and what they look like on the trail, and raises the alarm for them if they
don't come back on time.

## The model in one paragraph

A user keeps a short list of emergency contacts: people who don't need
PackRat, just a phone number or an email address. When the user starts a
trip, PackRat asks whether to notify their emergency contacts. If they say
yes, the contacts get a text or email saying where the user has gone, when
they're due back and what gear would help someone recognise them, plus a link
to a page where they can follow the trip. While the trip is underway the user
can check in from the trail, and with their permission PackRat follows their
progress in the background. If the user drifts well off a planned route, the
contacts hear about it. When the user is home they tap **I'm Safe**, the
contacts are told, and the trip's location history is deleted. If they don't,
and the return time plus a grace period passes, PackRat sends the contacts an
overdue alert with the last known location and the full gear list, and asks
them to contact the authorities. PackRat's servers send that alert, not the
phone, so it goes out even if the phone is dead, lost or far from signal.

## Emergency contacts

Emergency contacts are kept in Settings. Each has a name and a mobile number,
an email address, or both. A contact can be added, edited or removed at any
time, and one can be set as the default ("Always notify Mom"), so every trip
includes them unless the user says otherwise.

Contacts receive messages from PackRat, never from the user's own number or
address, so the user's personal details are never exposed. The first message
a new contact receives says who added them and what being an emergency
contact means, so an overdue alert is never the first they've heard of it.

## Starting a trip

A trip has a **Start Trip** button on its page, shown prominently on the day
the trip begins. Starting a trip marks it as in progress and asks: **Notify
your emergency contacts?**

Saying yes opens a short setup, pre-filled so it takes a few seconds:

- **Who to tell.** The default contact is selected; others can be added.
- **Expected return.** Defaults to the evening of the trip's end date. The
  overdue alert counts from this time.
- **What I'll look like.** Shelter, outer layer, pack and anything else that
  helps someone be spotted, taken from the trip's linked pack, with a colour
  or short note added to each. The user confirms or edits it before sending.
- **Follow my progress.** Whether PackRat may track the user's location in
  the background for this trip.

Each contact then receives:

> Alex has started their trip: Enchantments Traverse. Expected return: Sat 14
> Sep, 7:00 PM. They are carrying: orange Big Agnes tent, red Patagonia rain
> jacket. Track live progress: [link]

A shield icon in the trip header shows that the safety check-in is active.

Starting a trip works without signal. If the phone is offline, the start is
saved and sent as soon as there is a connection, and the trip page shows
plainly that the contacts have not been told yet. The overdue timer starts
once the contacts have been told, so the user should start the trip before
leaving signal.

## The trip page for contacts

The link in every message opens a web page that a contact can read without
an account or an app. It shows the trip's name and destination, the dates and
expected return, the identifying gear, the full gear list, and the user's
progress on a map: every check-in and, when tracking is on, the latest known
location and the path so far. It updates as new locations arrive.

The page stops working when the user marks themselves safe.

## Checking in from the trail

A **Check In** button on the trip page records the user's location and the
time and sends both to their contacts: "Alex checked in at 2:14 PM near
Colchuck Lake." A short note can be added.

Checking in works in Airplane Mode or with no signal. The check-in is saved
on the phone and sent as soon as a connection returns, along with the time it
was made, so a contact never mistakes an old position for a new one.

## Following progress

If the user allowed it when starting the trip, PackRat records their location
in the background while the trip is in progress. It records a new position
when the user has moved a meaningful distance rather than polling GPS
constantly, so a day on the trail costs little battery. Positions are
collected offline and uploaded whenever the phone has signal. They feed the
contacts' map and the "last known location" in an overdue alert.

Tracking only happens while a trip is in progress, and it stops when the user
marks themselves safe or ends the check-in.

## Leaving the planned route

When a trip has a planned route, such as an imported GPX track, PackRat
compares the user's progress against it. If the user moves well away from
the route and stays away, the contacts get an update: "Alex is about 2 miles
off their planned route for Enchantments Traverse. Latest location: [link]".
A deliberate change of plan is no cause for alarm, so the user is told when
an update has gone out and can add a note to it from the trip page.

Trips without a planned route never send off-route updates.

## Running late

While a check-in is active, the trip page shows a countdown to the time the
overdue alert will be sent.

An hour before the expected return, PackRat reminds the user that their
contacts are expecting them. From that reminder, or from the trip page, they
can mark themselves safe or push the return time back. Extending tells the
contacts the new time, so a change of plan on the trail reaches home the same
way the original plan did.

## The overdue alert

If the user hasn't marked themselves safe by the expected return plus a grace
period (two hours by default), every contact on the trip receives:

> Alex is overdue on Enchantments Traverse by 2 hours. Last known location:
> 4:40 PM near Colchuck Lake. Full gear list and trip details: [link]. Please
> contact the authorities.

The page behind the link holds everything a search team asks for: the
destination, the plan, the last known location, the path so far, and what the
user is wearing and carrying.

Because PackRat's servers send the alert, a user whose battery died on the
trail is still reported overdue. It also works the other way: a user who taps
I'm Safe while out of signal isn't marked safe until that reaches PackRat. If
the alert has already gone out by then, the contacts get a follow-up saying
the user is safe as soon as it arrives.

## I'm Safe

A large red **I'm Safe** button sits on the trip page while a check-in is
active. Tapping it marks the trip complete, cancels any pending overdue alert
and tells the contacts the user is back. The contacts' trip page stops
working, and every location recorded during the trip, from check-ins and
tracking alike, is deleted.

## Staying in control

- **Opt-in.** Nothing is sent unless the user agrees to notify contacts when
  starting a trip. Saved emergency contacts send nothing on their own.
- **Choose the contacts each time.** The default contact is a starting point,
  not a requirement.
- **Tracking is separate.** Contacts can be notified without background
  tracking. Tracking needs the user's permission and only runs while a trip
  is in progress.
- **Grace period.** Two hours by default, adjustable when starting a trip.
- **Cancel at any time.** A check-in can be ended from the trip page. The
  contacts are told it was called off, so nobody is left wondering.
- **Nothing kept.** Location history is deleted when the trip is marked
  complete, and everything sent to contacts travels over secure connections.

## What this feature does not do

- No contacting emergency services. PackRat tells the user's contacts, and
  they decide when to call the authorities.
- No satellite messaging. Anything sent with no signal waits until there is
  signal.
- Contacts can't reply inside the app. They reach the user however they
  normally would.
