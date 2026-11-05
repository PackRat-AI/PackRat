# Voice commands

Lets a user run the trip they're on and hear where they stand without taking the phone out of a pocket or pack.

## The model in one paragraph

While a trip is in progress, a user can talk to PackRat instead of tapping it. They start listening by holding the microphone button on the trip page, pressing a headset button, or asking Siri or the phone's assistant to "ask PackRat". They say a short command, such as "check in", "how far to go" or "I'm safe", and PackRat does it and answers out loud. Recognition happens on the phone, so commands work in Airplane Mode and far from signal. The set of commands is small and fixed, each one maps to something the trip page already does, and anything that tells other people something is read back for a spoken "yes" first, so a misheard word never sends an alert.

## Starting a command

PackRat only listens when asked to. There are three ways to ask:

- **Hold to talk.** A microphone button on the trip page while the trip is in progress. PackRat listens for as long as it's held.
- **Headset.** A long press on a connected headset's button, while the trip is in progress, starts listening without unlocking the phone.
- **The phone's assistant.** "Hey Siri, ask PackRat how far to go" on iPhone, or the Google Assistant equivalent on Android, from the lock screen or with the phone in a pocket.

A short tone marks the start and the end of listening. If nothing is heard after a few seconds, PackRat stops listening with a second tone and says nothing more.

## The commands

Each command has a few natural phrasings, so "check in", "send a check-in" and "let them know I'm OK" all do the same thing.

- **Start my trip.** Starts today's trip, the same as the Start Trip button. If the user has a default emergency contact, PackRat asks "Notify Sam?" and waits for yes or no.
- **Check in.** Records a check-in for the trip's contacts. PackRat says "Checking in with Sam and Jo near Colchuck Lake. Send it?" and sends on "yes".
- **I'm safe.** Marks the user safe and ends the trip. PackRat confirms first: "Mark yourself safe and end Enchantments Traverse?"
- **Add an hour.** Pushes the expected return back by the time spoken ("add two hours", "I'll be back at eight"). PackRat reads the new time back before telling the contacts.
- **Where am I.** Says the nearest named place and how far away it is: "About half a mile north-east of Colchuck Lake, at 5,600 feet."
- **How far to go.** On a trip with a planned route, says the distance and climb left to the end of it: "3.2 miles and 1,400 feet of climbing to go." On a trip without one, PackRat says so.
- **Am I on route.** On a trip with a planned route, says whether the user is on it, and if not, how far off and in which direction to head back: "You're about 300 feet west of your route. Head east to rejoin it."
- **When am I due back.** Says the expected return time and how long is left before the overdue alert.
- **Weather.** Reads the latest forecast PackRat has for the trip's location, and says how old it is when it couldn't be refreshed.

Anything PackRat doesn't recognise gets "Sorry, I didn't catch that" and a short list of what it can do. It never guesses at a command that sends something.

## Spoken answers

Answers are short, said once and also shown on screen as a banner on the trip page. Distances and heights follow the user's chosen units. Answers play through the connected headset when there is one, and otherwise through the speaker at the phone's media volume.

## Confirming before anything is sent

Check in, I'm safe and changing the return time all tell other people something, so each is read back and needs a spoken "yes", "send it" or "confirm". "No", "cancel" or silence drops it. Commands that only answer a question run straight away.

## Without signal

Commands are recognised and answered on the phone, with no connection needed. A check-in, a return-time change or I'm safe made without signal is saved and sent when the phone reconnects, the same as when tapped, and PackRat says so: "Saved. It'll send when you have signal."

## What the user controls

- **On or off.** Voice commands can be turned off entirely in Settings, which hides the microphone button and the headset shortcut.
- **Headset shortcut.** Can be turned off separately for users whose headset button already does something else.
- **Spoken answers.** Can be switched to on-screen only, for users who just want to talk and read.
- **Microphone permission.** Asked for the first time a command is started, never before. Saying no leaves every other part of the trip page working.

## What this feature does not do

- No always-on listening or wake word. PackRat only hears what's said while the user has asked it to listen, and keeps no recordings.
- No turn-by-turn navigation or route guidance beyond "am I on route" and "how far to go".
- No dropping waypoints or taking notes by voice.
- No free-form questions. The command list is fixed; open questions belong in chat.
- No voice control outside an in-progress trip, such as editing packs or browsing gear.
- No unprompted spoken alerts. PackRat speaks only to answer a command.
