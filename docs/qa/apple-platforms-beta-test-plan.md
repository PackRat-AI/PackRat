# iPhone, Apple Watch and Mac: beta tester guide

PackRat on iPhone, Mac and Apple Watch. Three places to test.

All three come from TestFlight. Install the iPhone app, install the Mac app, and
the watch app arrives with the iPhone one. The watch section explains how.

The app should feel the same everywhere. It is worth
reporting where it does not.

## Before you start

Note the OS version you are on and which of the three you tested. Every report
needs to say where it happened.

This release covers packs, trips, weather, the assistant, the catalog, guides and
gear inventory. Feed, Shopping List, Wildlife, Trails and Pack Insights are not
part of it and do not appear on screen anywhere, so there is nothing to report
there.

## iPhone

TestFlight, iOS.

Five tabs along the bottom: Home, Packs, Trips, Assistant, Profile. Catalog,
Templates, Trail Conditions, Guides, Gear Inventory and AI Packs are not on the
tab bar. Reach those from Home.

### Signing in

- Create a new account. Do you land in the app, signed in?
- Force quit from the app switcher and reopen. Are you still signed in?
- Sign out, sign back in. Does your data come back, or does the screen stay
  empty?
- Google or Apple sign-in, if offered, leaves the app and comes back. Confirm it
  returns you signed in rather than stranding you.
- Password reset. The email should arrive and the new password should work.
- Type a wrong password on purpose. You should get a clear message, not a
  spinner that never stops.

### Packs

Packs get more attention here than anything else, because a wrong weight is the
one bug a tester can catch that nobody else will.

- Create a pack. Add several items with different weights.
- Check the total and base weight are right. Do the arithmetic yourself once.
- Change an item's weight. Does the total follow immediately?
- Change your units in Settings between metric and imperial. Every weight in the
  app should switch, and the numbers should still be correct.
- Delete an item, then delete the pack. Both should ask first.
- Weight Analysis, from the pack. Does the chart match the items?
- Pack Templates: make a template, then create a pack from it. Does everything
  carry across?

### Trips

- Create a trip with a name, a location and start and end dates.
- The location search should return real places as you type.
- Save, leave the screen, reopen. Did the dates and location survive?
- Attach a pack to a trip if the screen offers it.
- Edit the trip, change the dates, save again.

### Weather

- Weather for a trip location. Do you get a temperature and a forecast?
- Somewhere remote or foreign. Still works?
- Turn on airplane mode. You should see a clear message or older data, never a
  blank screen or a crash.

### Assistant

- Ask it something ordinary, like what to pack for two nights of rain.
- Ask it to add something to a pack, then check the pack actually changed.
- Send a long message, then a very short one.
- Kill your connection mid-answer. It should recover, not hang.

### Catalog, guides and gear inventory

- Search the catalog. Do results look sensible for what you typed?
- Open an item. Is the detail screen complete, or are there empty fields?
- Add a catalog item to a pack.
- Read a guide end to end. Any text cut off or overlapping?

### Things that break apps

- Rotate the phone on a few screens.
- Turn the text size up in iOS Settings, then come back. Is anything unreadable
  or clipped?
- Switch to dark mode and look over the screens again.
- Background the app for ten minutes, come back. Where were you, and is the data
  still fresh?
- Poor connection, not no connection. Two bars in a lift is where bugs live.

## Mac

TestFlight, macOS tab. It is a separate app from the iPhone one, so install it
there.

The Mac version has a sidebar down the left instead of tabs, with a list and a
detail panel side by side. Everything in the iPhone list above is worth trying
here too. The sections below cover what only the Mac does.

### Windows

- Resize the window small, then very large. Does the layout follow, or does
  content clip and overlap?
- Full screen, then back out.
- Open a second window with Cmd-N. Do both windows work independently?
- Close the last window. Does the app stay in the Dock, and can you get a window
  back?
- Drag the sidebar divider. Collapse the sidebar entirely, then bring it back.

### Keyboard and menus

- Tab through a form. Does focus move in a sensible order, and can you see where
  it is?
- Cmd-C, Cmd-V, Cmd-A in text fields.
- Walk the whole menu bar. Anything greyed out that should work, or does nothing
  when clicked, is a bug.
- Escape should close sheets and dialogs.
- Any keyboard shortcut listed in a menu should do what the menu says.

### Two screens at once

- Open a pack in one window and a trip in another. Change the pack. Does the
  other window notice?
- Sign out in one window while another is open.

## Apple Watch

The watch app comes with the iPhone app rather than as its own TestFlight entry.
Install PackRat on the iPhone first, then open the Watch app on the phone, scroll
to Available Apps, and install PackRat from there. Some watches pick it up on
their own, in which case it is already on your wrist.

You need the iPhone app signed in before the watch shows anything. The watch has
no login of its own. It reads what the phone sends it.

The watch app has four screens. Scroll between them with the Digital Crown.

### Trail Ready

- Before your phone has sent anything it says "Sync from iPhone". Not blank, not
  zeroes.
- Once it syncs: pack name, base weight, a packed count like `3/12`, and the
  weather.
- The bottom line says either "iPhone Nearby" or "Last Synced". Walk away from
  your phone, or turn its Bluetooth off, and confirm it changes.

### Checklist

- With nothing synced it says "No Items" rather than showing an empty list.
- Items match the pack on your phone, and "3 of 12 packed" agrees with the
  toggles.
- Toggle an item, leave the screen, come back. It should still be toggled. Then
  check the same item on your phone, where it should be ticked too. This is the
  most important thing on the watch, so try it a few times.

### Weather

- Location, temperature and condition, matching the phone for the same trip.
- With nothing synced it shows `--` rather than a wrong number.

### Trail Report

- Pick a condition, type a note, tap Save Draft.
- A green "Draft queued" appears.
- Leave the screen and come back. The draft is still there.
- Check the phone. The draft arrived.
- Leave your phone behind, or turn it off, and save another. It queues and syncs
  when the phone is back, rather than losing your note.

## Reporting

One bug per post in the thread. What you did, what happened, what you expected
instead. Include the OS version and whether it was iPhone, Mac or watch.

Screenshots help everywhere. On the watch, press the Digital Crown and the side
button together to take one. It lands in your phone's photos.

Anything merely annoying rather than broken is still worth a post. A weight that
comes out wrong counts, and so does a screen that takes too long.
