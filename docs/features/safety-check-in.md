# Safety check-in

Makes sure someone at home knows where a user went, when they should be back,
and what they look like on the trail — and raises the alarm for them if they
don't come back on time.

## The model in one paragraph

A user keeps a short list of emergency contacts: people who don't need
PackRat, just a phone number or an email address. When a trip begins, the
user starts a check-in for it and sets the time they expect to be back. Their
chosen contacts get a message saying where they've gone, when they're due
back, what gear they're carrying that would help someone recognise them, and
a link to a page that holds all of it. Along the way the user can check in
from the trail, and each check-in reaches the contacts with where they were
and when. When the user is home they tap **I'm Safe**, the contacts are told,
and the check-in is over. If they don't, and the return time plus a grace
period passes, PackRat sends the contacts an overdue alert with the trip plan,
the last known location and the full gear list, and asks them to contact the
authorities. That alert is sent by PackRat, not by the phone, so it goes out
even if the phone is dead, lost, or far from signal.

## Emergency contacts

Emergency contacts live in the user's profile. Each has a name and a mobile
number, an email address, or both. A contact can be added, edited or removed
at any time, and one can be marked as the default, so every check-in includes
them unless the user says otherwise.

Contacts receive messages from PackRat, never from the user's own number or
address. The first message a new contact receives says who added them and
what being an emergency contact means, so an overdue alert is never the first
they've heard of it.

## Starting a check-in

On the day a trip starts, its trip page offers to start a safety check-in.
The user can also start one from the trip page at any time while the trip is
underway.

Starting a check-in asks for three things, each pre-filled so it takes a few
seconds:

- **Who to tell.** The default contact is selected; others can be added.
- **Expected return.** Defaults to the evening of the trip's end date. This is
  the time the overdue alert counts from.
- **What I'll look like.** Shelter, outer layer, pack, and anything else that
  helps someone be spotted — drawn from the trip's linked pack, with a colour
  or short note added to each. The user confirms or edits it before sending.

Once started, each contact receives:

> Alex has started their trip: Enchantments Traverse. Expected back: Sat 14
> Sep, 7:00 PM. Carrying: orange Big Agnes tent, red Patagonia rain jacket,
> grey Osprey pack. Trip details: [link]

Starting a check-in needs a connection, so the trip page suggests doing it
before leaving signal. If the phone is offline when the user starts it, the
check-in is held and sent as soon as there is signal, and the trip page shows
plainly that the contacts have not been told yet. The overdue timer does not
run until the contacts have been told.

## The trip page for contacts

The link in every message opens a web page a contact can read without an
account or an app. It shows the trip's name and destination, the dates and
expected return, the identifying gear, the full gear list, and every
check-in so far with its time and location on a map. It updates as check-ins
arrive.

The page stops working when the user marks themselves safe.

## Checking in from the trail

A **Check In** button on the trip page records the user's location and the
time and sends both to their contacts: "Alex checked in at 2:14 PM near
Colchuck Lake." An optional short note can go with it.

Checking in works with no signal. The check-in is saved on the phone and sent
the moment a connection returns, carrying the time it was actually made, so a
contact never mistakes an old position for a new one.

Location is only ever read when the user checks in. Nothing is tracked in the
background, and nothing is shared between check-ins.

## Running late

The trip page shows a countdown to the expected return while a check-in is
active.

An hour before the return time, PackRat reminds the user that their contacts
are expecting them. From that reminder, or from the trip page, they can mark
themselves safe or push the return time back. Extending tells the contacts
the new time, so a plan that changes on the trail reaches home the same way
the original one did.

## The overdue alert

If the user hasn't marked themselves safe by the expected return plus a grace
period — two hours by default — every contact on the check-in receives:

> Alex is overdue from Enchantments Traverse by 2 hours. They were expected
> back Sat 14 Sep at 7:00 PM. Last check-in: 2:14 PM near Colchuck Lake. Full
> plan and gear list: [link]. If you can't reach them, contact the
> authorities.

The trip page behind the link carries everything a search team asks for: the
destination, the plan, the last known location, and what the user is wearing
and carrying.

Because the alert comes from PackRat rather than the phone, a user whose
battery died on the trail is still reported overdue. The same is true in
reverse: a user who taps I'm Safe while out of signal is not marked safe until
that reaches PackRat. If the alert has already gone out by then, the
contacts receive a follow-up that the user is safe as soon as it does.

## I'm Safe

A large **I'm Safe** button sits on the trip page for as long as a check-in is
active. Tapping it ends the check-in, cancels any overdue alert, and tells the
contacts the user is back. The trip page for contacts stops working, and the
locations recorded by check-ins are deleted.

## Staying in control

- **Opt-in, every trip.** Nothing is sent for a trip unless the user starts a
  check-in for it. Having emergency contacts saved sends nothing on its own.
- **Choose the contacts each time.** The default contact is a starting point,
  not a requirement.
- **Grace period.** Two hours by default, adjustable when starting a
  check-in.
- **Location on request only.** Shared when the user checks in, never
  otherwise, and deleted when they mark themselves safe.
- **Cancel at any time.** A check-in can be ended from the trip page; the
  contacts are told it was called off rather than left wondering.

## What this feature does not do

- No background location tracking or live breadcrumb trail — position is
  shared only at a check-in.
- No off-route detection or alerts for straying from a planned route.
- No contacting emergency services. PackRat tells the user's contacts; they
  decide when to call the authorities.
- No satellite messaging. Check-ins sent with no signal wait for signal.
- No replies from contacts inside the app; they reach the user however they
  normally would.
