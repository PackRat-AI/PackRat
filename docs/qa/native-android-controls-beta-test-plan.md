# Native Android controls: beta tester guide

Build `feat/expo-ui-migration-sdk57`, Android only, Expo SDK 57.

A lot of PackRat's switches, dialogs, menus and pickers used to be hand-built to
look like Android. Now they are the real Android ones.

The app should do exactly what it did before. Only the look and feel of those
controls changed.

What we need from you is confirmation that nothing broke. These controls sit on
top of real actions like deleting a pack, confirming your account, and saving
trip dates, so a small failure here costs more than usual.

## What to check

Go through as much screens as possible. The question each time is
whether the control still does what it says.

### Bottom sheets, the panels that slide up

Pack detail (the `⋯` menu), adding a pack item, choosing a trip location, the AI
chat mode picker, pack template options.

- Does it slide up when you tap whatever opens it?
- Can you close it? Try all three: swipe down, tap the dimmed area above it,
  press the Android back button. Every one of those should close it.
- If closing it was meant to do something, like deleting an item you just
  confirmed, did that actually happen?

### Confirmation dialogs

Sign-in and sign-up errors, deleting a pack, deleting your account, and the `⋯`
menus on the dashboard tiles (Weight Analysis, Gear Inventory, Pack Stats).

- The dialog should look like a normal Android dialog now.
- Both buttons need to work. Cancel should change nothing. The other button
  should do what it says.
- Back button should behave like Cancel.
- Deleting your account still asks you to type a confirmation. We did not touch
  that flow, but please try it if you have a test account to spare.

### Switches, checkboxes and segmented buttons

Settings (Display Units), notification preferences, weather alert preferences,
"Show password" on sign-up and password reset, and the filter tabs on Packs and
Templates.

- The switches are visibly bigger than before. That is the standard Android
  size, so it is intended.
- Flip one, leave the screen, come back and confirm that it persists.
- Verify that the setting actually takes effect.

### Date picker

Creating or editing a trip, on Start Date and End Date.

- Tapping the field should open an Android calendar.
- Pick a date and tap OK. The field should show it.
- Tap Cancel and nothing should change.
- Save the trip, reopen it, check the date survived.

### Cards

Gear catalog items, Guides, Trip detail, AI chat responses.

- Text should be fully visible rather than cut off or overlapping.
- Nothing should spill past the card's edges.
- Buttons inside cards should still be tappable.

## Reporting

Include which screen you were on and what you tapped, what you expected
compared to what happened, a screenshot or recording if it is visual, and your
phone model and Android version.

Tell us straight away about any of these:

- A sheet or dialog you cannot close
- A button that does nothing
- A button that does the wrong thing, especially anything that deletes
- Text you cannot read, or a control you cannot tap
- A setting that does not stick

No need to report these, they are known:

- Switches being bigger
- Dialogs and menus looking more Android-ish than before, which is the point
