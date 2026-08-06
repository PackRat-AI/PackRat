# iPhone, Apple Watch and Mac: beta tester guide

PackRat on Apple platforms. Three places to test: **iPhone**, **Mac**, and the
**Apple Watch**.

iPhone and Mac come from TestFlight. The watch app is not on TestFlight yet, so
it needs a Mac with Xcode — there are instructions further down. If you cannot
do the watch part, say so and test the other two.

The app should feel the same everywhere. Where it does not, that is what we want
to hear about.

## Before you start

Tell us the OS version you are on and which of the three you tested. When
something breaks, we need to know where.

Some screens are switched off in this build on purpose. If you do not see Feed,
Shopping List, Wildlife, Trails or Pack Insights anywhere, that is expected and
not a bug.

## iPhone

TestFlight, iOS.

Five tabs along the bottom: Home, Packs, Trips, Assistant, Profile. Some screens
live inside Home rather than on the tab bar — Catalog, Templates, Trail
Conditions, Guides, Gear Inventory and AI Packs are reached from there.

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

This is the core of the app, so it gets the most attention.

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

### Catalog, Guides, Gear Inventory

- Search the catalog. Do results look sensible for what you typed?
- Open an item. Is the detail screen complete, or are there empty fields?
- Add a catalog item to a pack.
- Read a guide end to end. Any text cut off or overlapping?

### Things that break apps

- Rotate the phone on a few screens.
- Turn the text size up in iOS Settings, then come back. Is anything unreadable
  or clipped?
- Dark mode.
- Background the app for ten minutes, come back. Where were you, and is the data
  still fresh?
- Poor connection, not no connection. Two bars in a lift is where bugs live.

## Mac

TestFlight, macOS tab. It is a separate app from the iPhone one, so install it
there.

The Mac version has a sidebar down the left instead of tabs, and shows a list
and a detail panel side by side. Everything from the iPhone list above is worth
repeating here, but these are the parts that only exist on the Mac.

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

Not on TestFlight yet, so this needs a Mac with Xcode and the repo checked out.

In Xcode, open Window ▸ Devices and Simulators, and pair an Apple Watch
simulator with an iPhone simulator. Then:

```
cd apps/swift
bun scripts/watch-sync-smoke.ts
```

That builds both apps, installs them onto the pair, and checks a sync arrives.
If it stops with "not visible after install attempts", tell us and stop there —
that is a known problem on our side, not something you did.

The watch app has four screens. Scroll between them with the Digital Crown.

### Trail Ready

- Before anything syncs it should say "Sync from iPhone". Not blank, not zeroes.
- After a sync: pack name, base weight, a packed count like `3/12`, and the
  weather.
- The bottom line says either "iPhone Nearby" or "Last Synced". Background the
  iPhone simulator and confirm it changes.

### Checklist

- With nothing synced it should say "No Items", not show an empty list.
- Items should match the pack you synced, and "3 of 12 packed" should agree with
  the toggles.
- **Toggle an item, leave the screen, come back.** We think the toggle does not
  stick and does not tell the phone. Confirming that is the single most useful
  thing you can do on the watch.

### Weather

- Location, temperature and condition, matching the phone for the same trip.
- With nothing synced it should show `--` rather than a wrong number.

### Trail Report

- Pick a condition, type a note, tap Save Draft.
- A green "Draft queued" should appear.
- Leave the screen and come back. Is the draft still there?
- Check the phone. Did the draft arrive?
- Shut the iPhone simulator down and save another. It should queue, not lose
  your note.

## Reporting

One bug per post in the thread. What you did, what happened, what you expected
instead. Include the OS version and whether it was iPhone, Mac or watch.

Screenshots help everywhere. On the watch, a screenshot of the simulator window
is fine.

If something is merely annoying rather than broken, still tell us. Wrong weights,
confusing wording and slow screens are all worth a post.
