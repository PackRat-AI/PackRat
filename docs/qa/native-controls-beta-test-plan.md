# Native platform controls: beta tester guide

Build `feat/expo-ui-migration-sdk57`, iOS and Android, Expo SDK 57.

A lot of PackRat's switches, dialogs, menus, sheets and pickers used to be
hand-built to look like the platform. Now they are the real thing, the same
widgets your phone uses everywhere else.

The app should do exactly what it did before. Only the look and feel of those
controls changed.

What we need from you is confirmation that nothing broke. These controls sit on
top of real actions like deleting a pack, confirming your account, and saving
trip dates, so a small failure here costs more than usual.

## Where to spend your time

Test both devices, but weight it toward Android. That is where most of this
build landed: checkboxes, confirmation dialogs, cards and the overflow menus are
all new on Android. On iOS the changes are narrower, so a lighter pass is fine.

Some things changed on Android and not on iOS. If a checkbox or card looks
identical on your iPhone, that is expected rather than a bug.

## What to check

Go through as much screens as possible. The question each time is
whether the control still does what it says.

### Bottom sheets, the panels that slide up

Changed on both platforms. Pack detail (the `⋯` menu), adding a pack item,
choosing a trip location, the AI chat mode picker, pack template options.

- Does it slide up when you tap whatever opens it?
- Can you close it? Swipe down, tap the dimmed area above it, and on Android
  press the back button. Every one of those should close it.
- If closing it was meant to do something, like deleting an item you just
  confirmed, did that actually happen?

Start here. We found a bug during development where two sheets could not be
closed at all, so it is the area most worth your time.

### Confirmation dialogs

Android only. Sign-in and sign-up errors, deleting a pack, deleting your
account, and the `⋯` menus on the dashboard tiles (Weight Analysis, Gear
Inventory, Pack Stats).

- The dialog should look like a normal Android dialog now.
- Both buttons need to work. Cancel should change nothing. The other button
  should do what it says.
- Back button should behave like Cancel.
- Deleting your account still asks you to type a confirmation. We did not touch
  that flow, but please try it if you have a test account to spare.

### Overflow menus

Android only. The `☰` at the top left of Messages, and chat threads.

- Tap it and the menu should appear anchored to the button.
- Pick at least two items and check each one still does its job.
- Tapping outside or pressing back should close it and do nothing else.

### Switches and segmented buttons

Switches and the segmented tabs changed on both platforms. Checkboxes changed on
Android only. Settings (Display Units), notification preferences, weather alert
preferences, "Show password" on sign-up and password reset, and the filter tabs
on Packs and Templates.

- On Android the switches are visibly bigger than before. That is the standard
  Android size, so it is intended.
- Flip one, leave the screen, come back and confirm that it persists.
- Verify that the setting actually takes effect.

### Date picker

Changed on both platforms. Creating or editing a trip, on Start Date and End
Date.

- Tapping the field should open the platform calendar.
- Pick a date and confirm. The field should show it.
- Cancel and nothing should change.
- Save the trip, reopen it, check the date survived.

### Cards

Android only. Gear catalog items, Guides, Trip detail, AI chat responses.

- Text should be fully visible rather than cut off or overlapping.
- Nothing should spill past the card's edges.
- Buttons inside cards should still be tappable.

### Loading spinners

Changed on both platforms, and they show up all over the app.

- They should still appear while something is loading, and disappear when it
  finishes.

## Reporting

Include which screen you were on and what you tapped, what you expected
compared to what happened, a screenshot or recording if it is visual, and which
device and OS version you were on. Since you are testing two, tell us which one
each report came from.

Tell us straight away about any of these:

- A sheet or dialog you cannot close
- A button that does nothing
- A button that does the wrong thing, especially anything that deletes
- Text you cannot read, or a control you cannot tap
- A setting that does not stick

No need to report these, they are known:

- Android switches being bigger
- Android dialogs and menus looking more Android-ish than before, which is the point
- A control looking unchanged on iOS when it changed on Android
