# Native platform controls: beta tester guide

A lot of PackRat's switches, dialogs, menus, sheets and pickers used to be
custom replica to look like the ones your phone uses natively. Now
they are the real ones, the same controls you get in your phone's own settings
and its built-in apps.

The app should do exactly what it did before. Only the look and feel of those
controls changed.

## Where to spend your time

Test both devices, but prioritize Android because we're moving the iPhone app to a new build soon. Also the changes on iPhone are narrower, so a lighter pass is fine.

## What to check

Go through as many screens as possible. The question each time is
whether the control still does what it says.

### Bottom sheets, the panels that slide up

Changed on both platforms. Pack detail (the `⋯` menu), adding a pack item,
choosing a trip location, the AI chat mode picker, pack template options.

- Does it slide up when you tap whatever opens it?
- Can you close it? Swipe down, tap the dimmed area above it, and on Android
  press the back button. Every one of those should close it.
- If closing it was meant to do something, like deleting an item you just
  confirmed, did that actually happen?

### Confirmation dialogs

Android only. Sign-in and sign-up errors, deleting a pack, deleting your
account.

- The dialog should look like a normal Android dialog now.
- Both buttons need to work. Cancel should change nothing. The other button
  should do what it says.
- Back button should behave like Cancel.
- Deleting your account still asks you to type a confirmation.

### Switches and segmented buttons

Switches and the segmented tabs changed on both platforms. Checkboxes changed on
Android only. Settings (Display Units), weather alert
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

## Notes

No need to report these, they are known:

- Android switches being bigger
- Android dialogs and menus looking more Android-ish than before, that is the point
