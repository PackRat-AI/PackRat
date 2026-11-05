# Voice commands

Lets a user run the trip they're on, record it, mark places along it and be guided along it without taking the phone out of a pocket or pack.

## The model in one paragraph

While a trip is in progress, a user can talk to PackRat instead of tapping it. They say "Hey PackRat", hold the microphone button on the trip page, press a headset button, or ask Siri or the phone's assistant to "ask PackRat". They say a short command, such as "start tracking", "mark waypoint", "navigate to camp" or "I'm safe", and PackRat does it and answers out loud. Once it is guiding the user somewhere, PackRat speaks up on its own at each turn and when they stray. Recognition happens on the phone, so everything works in Airplane Mode and far from signal. The set of commands is fixed, and anything that tells other people something is read back for a spoken "yes" first, so a misheard word never sends an alert.

## Starting a command

There are four ways to get PackRat listening:

- **"Hey PackRat."** With hands-free listening on, saying "Hey PackRat" while a trip is in progress starts a command, with the phone locked and in a pocket. The wake phrase is detected on the phone, and nothing said before it is kept or sent anywhere.
- **Hold to talk.** A microphone button on the trip page while the trip is in progress. PackRat listens for as long as it's held.
- **Headset.** A long press on a connected headset's button, while the trip is in progress, starts listening without unlocking the phone.
- **The phone's assistant.** "Hey Siri, ask PackRat how far to go" on iPhone, or the Google Assistant equivalent on Android, from the lock screen.

A short tone marks the start and the end of listening. If nothing is heard after a few seconds, PackRat stops listening with a second tone and says nothing more.

## The commands

Each command has a few natural phrasings, so "check in", "send a check-in" and "let them know I'm OK" all do the same thing.

### Recording the hike

- **Start tracking.** Starts recording the user's path: distance, time moving and climb. If no trip is in progress, PackRat starts today's trip first. "Tracking started. I'll keep recording with the screen off."
- **Pause tracking** and **resume tracking.** For a long lunch or a ride back to the trailhead.
- **Stop tracking.** Stops recording and says the totals: "Stopped. 8.4 miles, 2,900 feet of climbing, 4 hours 10 moving." The recorded path becomes the trip's route in its log.
- **How far have I gone.** Says the distance, climb and time so far.

### Marking places

- **Mark waypoint.** Drops a waypoint at the user's current position, named by time ("Waypoint 2:14 PM"). Saying a name with it, "mark waypoint water source", names it.
- **Note.** "Note: trail washed out past the bridge" saves the spoken words with the user's position, as a waypoint with a note.

Waypoints and notes appear on the trip's map and route, and can be navigated to.

### Finding the way

- **Where am I.** Says the nearest named place and how far away it is: "About half a mile north-east of Colchuck Lake, at 5,600 feet."
- **Navigate to [place].** Starts guidance to a waypoint the user marked, a waypoint on the planned route, or the end of the route, such as "navigate to camp" or "navigate to the trailhead". PackRat follows the planned route where there is one and points straight to the place where there isn't.
- **How far to destination.** Says the distance and climb left to where PackRat is guiding the user, or to the end of the planned route: "3.2 miles and 1,400 feet of climbing to go."
- **Am I on route.** Says whether the user is on their route, and if not, how far off and which way to head back.
- **Stop navigating.** Ends guidance. Tracking carries on.

### The trip and the people at home

- **Check in.** Records a check-in for the trip's contacts. PackRat says "Checking in with Sam and Jo near Colchuck Lake. Send it?" and sends on "yes".
- **I'm safe.** Marks the user safe, stops tracking and ends the trip. PackRat confirms first: "Mark yourself safe and end Enchantments Traverse?"
- **Add an hour.** Pushes the expected return back by the time spoken ("add two hours", "I'll be back at eight"). PackRat reads the new time back before telling the contacts.
- **When am I due back.** Says the expected return time and how long is left before the overdue alert.
- **Weather.** Reads the latest forecast PackRat has for the trip's location, and says how old it is when it couldn't be refreshed.

Anything PackRat doesn't recognise gets "Sorry, I didn't catch that" and a short list of what it can do. It never guesses at a command that sends something.

## Turn-by-turn guidance

While navigating, PackRat speaks without being asked:

- **Before each turn** where the route leaves the trail the user is on or bends sharply: "In 400 feet, bear left onto Stuart Lake Trail."
- **At milestones** along the way: "Halfway to camp. 2.1 miles to go."
- **When the user strays.** If they move well off the route and stay off it, PackRat says so and points them back: "You're off route. Head east about 300 feet to rejoin it." It says it once, then again only if they move further away.
- **On arrival.** "You've reached camp."

Prompts use names from the trail map where they exist and compass directions where they don't. Guidance keeps running with the screen off and the phone in a pocket.

## Safety alerts

While a trip is in progress, PackRat also speaks up for things the user needs to know straight away: a severe weather alert for where they are, an hour left before their contacts are told they're overdue, and the phone's battery running low enough to cut tracking short.

## Spoken answers

Answers and prompts are short, said once and also shown on screen as a banner on the trip page. Distances and heights follow the user's chosen units. They play through the connected headset when there is one, and otherwise through the speaker at the phone's media volume, lowering any music while they play.

## Confirming before anything is sent

Check in, I'm safe and changing the return time all tell other people something, so each is read back and needs a spoken "yes", "send it" or "confirm". "No", "cancel" or silence drops it. Everything else runs straight away.

## Without signal

Commands are recognised and answered on the phone, and tracking, waypoints and guidance need no connection. A check-in, a return-time change or I'm safe made without signal is saved and sent when the phone reconnects, the same as when tapped, and PackRat says so: "Saved. It'll send when you have signal."

## What the user controls

- **On or off.** Voice commands can be turned off entirely in Settings, which hides the microphone button and every shortcut.
- **"Hey PackRat."** Off until the user turns it on. When on, it listens only while a trip is in progress and stops when the trip ends.
- **Headset shortcut.** Can be turned off separately for users whose headset button already does something else.
- **Guidance prompts.** Turn prompts, milestones and off-route warnings can each be turned off, and prompts can be set to vibrate only.
- **Safety alerts.** Can be switched from spoken to a notification only.
- **Spoken answers.** Can be switched to on-screen only.
- **Microphone and location permission.** Asked for the first time they're needed, never before. Saying no to the microphone leaves every other part of the trip page working.

## What this feature does not do

- No free-form questions. The command list is fixed; open questions belong in chat.
- No voice control outside a trip, such as editing packs or browsing gear.
- No road or driving directions. Guidance stops at the trailhead.
- No recordings kept. Speech is turned into a command on the phone and then discarded.
