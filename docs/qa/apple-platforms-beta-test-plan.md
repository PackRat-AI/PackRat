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
gear inventory.

## iPhone

Install this one from TestFlight on your phone.

Five tabs along the bottom: Home, Packs, Trips, Assistant, Profile. Catalog,
Templates, Trail Conditions, Guides, Gear Inventory and AI Packs are not on the
tab bar. Reach those from Home.

### Signing in

- Create a new account. Expect to land in the app already signed in.
- Force quit from the app switcher and open the app again. You should still be
  signed in.
- Sign out and sign back in. Expect your packs and trips to all come back rather
  than leaving you with empty screens.
- Sign in with Google or Apple. It should leave the app and bring you back signed
  in, not strand you on the login screen.
- Run a password reset all the way through. The email should arrive, and the new
  password should get you back in.
- Type a wrong password on purpose. Expect it to tell you clearly what went wrong
  instead of spinning forever.

### Packs

Packs get more attention here than anything else, because a wrong weight is the
one bug a tester can catch that nobody else will.

- Create a pack and add several items with different weights. Expect each one to
  land in the pack as you add it.
- Add the weights up yourself once. The total and base weight the app shows you
  should match what you worked out.
- Change one item's weight. Expect the total to update straight away rather than
  waiting until you leave the screen.
- Switch your units in Settings between metric and imperial. Every weight in the
  app should change over, and the numbers should still be right afterwards.
- Delete an item, then delete the whole pack. Expect both to ask you to confirm
  before anything disappears.
- Open Weight Analysis from the pack. The chart should reflect the items you
  actually added.
- Make a pack template, then create a pack from it. Expect everything in the
  template to carry across to the new pack.

### Trips

- Create a trip with a name, a location and start and end dates. It should save
  without complaining about any of those fields.
- As you type in the location search, expect it to offer you real places rather
  than coming back empty.
- Save the trip, leave the screen, then open it again. The dates and location
  should have survived exactly as you set them.
- Attach a pack to the trip using the Pack dropdown. It should show up on the trip
  once you save.
- Edit the trip, change the dates, and save again. Expect the new dates to stick.

### Weather

- Look up the weather for a trip location. Expect a temperature and a forecast
  rather than a loading state that never finishes.
- Try somewhere remote, or somewhere in another country. It should still come back
  with something sensible.
- Turn on airplane mode and open the weather again. Expect it to either tell you
  plainly that it cannot reach the network or show you the older data it already
  had. It should never go blank or crash.

### Assistant

- Ask it something ordinary, like what to pack for two nights of rain. The answer
  should actually address what you asked.
- Ask it to add something to one of your packs, then go and look at the pack. The
  item should really be there.
- Cut your connection while it is mid-answer. It should recover or tell you what
  happened, rather than hanging on a spinner.

### Catalog, guides and gear inventory

- Search the catalog for something. The results should be recognisably
  related to what you typed.
- Open one of the items. Expect the detail screen to be filled in rather than
  showing blank fields where information is missing.
- Add a catalog item to one of your packs. It should appear in the pack with its
  weight.
- Read one of the guides from top to bottom. Expect none of the text to be cut off
  or overlapping.

### Offline

PackRat is meant to work without a connection. You should be able to open it on a
trail with no signal and still get at your packs. This section matters as much as
the rest of the iPhone list.

- Use the app normally for a few minutes so it has something cached, then turn on
  airplane mode and reopen it. Your packs and trips should still be listed and not show empty screens or a spinner.
- Still in airplane mode, open a pack. Expect the items and weights to be there.
- Create a new pack while offline, and add a couple of items. It should save and
  appear in your list straight away.
- Edit an existing pack offline. Expect the change to stick when you leave the
  screen and come back.
- Delete something offline. It should disappear and stay gone.
- Turn airplane mode back off and give it a moment. Everything you did offline
  should still be there, and the packs you made offline should sync up and not
  vanish or turn into duplicates.
- Force quit while offline, then reopen with airplane mode still on. Expect your
  data to survive the restart.
- An orange banner reading "You're offline, showing cached data" should appear
  across the top while you have no connection, and it should disappear once you
  are back online.

### Things that break apps

- Switch to dark mode and look over the screens again. Expect the text to stay
  legible against the darker backgrounds.

## Mac

This one lives under the macOS tab in TestFlight. It is a separate app from the
iPhone one, so it has to be installed there.

The Mac version has a sidebar down the left instead of tabs, with a list and a
detail panel side by side. Everything in the iPhone list above is worth trying
here too. The sections below cover what only the Mac does.

### Windows

- Drag the window down to something quite small, then stretch it very wide. The
  layout should follow you the whole way without content clipping or overlapping.
- Go full screen and then come back out again. Nothing should be left misplaced.
- Open a second window with Cmd-N. Expect both windows to work independently of
  each other.
- Close the last window. The app should stay running in the Dock, and you should be
  able to get a window back from there.
- Drag the sidebar divider around, collapse the sidebar completely, then bring it
  back. Expect it to end up where you put it.

### Keyboard and menus

- Tab your way through a form. Focus should move in an order that makes sense, and
  you should always be able to see which field you are in.
- Try Cmd-C, Cmd-V and Cmd-A inside the text fields. Expect them to behave the way
  they do in any other Mac app.
- Walk through the whole menu bar. Anything greyed out that you would expect to
  work, or that does nothing at all when clicked, is worth reporting.
- Press Escape with a sheet or dialog open. It should close.
- Try the keyboard shortcuts the menus advertise. Each one should do what the menu
  says it does.

### Offline on the Mac

The Mac keeps its own cache, separate from your phone, so it is worth running the
offline checks here as well as on iPhone.

- Turn Wi-Fi off from the menu bar and reopen the app. Your packs and trips should
  still be there.
- Create and edit a pack with Wi-Fi off, then turn it back on. Expect your changes
  to survive and sync up.
- Have the app open on the Mac and your phone at once, make a change offline on
  one of them, then bring both back online. Expect them to agree with each other
  afterwards rather than one quietly overwriting the other.

### Two screens at once

- Open a pack in one window and a trip in another, then change something in the
  pack. Expect the other window to notice and catch up rather than showing you
  stale information.
- Sign out in one window while another one is still open. Expect both to end up
  signed out together.

## Apple Watch

The watch app comes with the iPhone app rather than as its own TestFlight entry.
Install PackRat on the iPhone first, then open the Watch app on the phone, scroll
to Available Apps, and install PackRat from there. Some watches pick it up on
their own, in which case it is already on your wrist.

You need the iPhone app signed in before the watch shows anything. The watch has
no login of its own. It reads what the phone sends it.

The watch app has four screens. Scroll between them with the Digital Crown.

### Trail Ready

- Look at this screen before your phone has sent anything. It should say "Sync
  from iPhone" rather than sitting blank or showing you a row of zeroes.
- Once it has synced, expect the pack name, the base weight, a packed count like
  `3/12`, and the weather.
- The bottom line should read either "iPhone Nearby" or "Last Synced". Walk away
  from your phone, or turn its Bluetooth off, and expect that line to change to
  match.

### Checklist

- With nothing synced yet, it should say "No Items" rather than showing you an
  empty list with no explanation.
- The items should match the pack on your phone, and expect the "3 of 12 packed"
  line to agree with however many toggles are actually on.
- Toggle an item, leave the screen, and come back. It should still be toggled.
  Then check the same item on your phone, where it should be ticked too. This is
  the most important thing on the watch, so try it a few times over.

### Weather

- The location, temperature and condition should all match what your phone shows
  for the same trip.
- With nothing synced, expect `--` rather than a made-up number.

### Trail Report

- Pick a condition, type yourself a note, and tap Save Draft. A green "Draft
  queued" should appear.
- Leave the screen and come back. The draft should still be there waiting for you.
- Now check your phone. Expect the draft to have arrived.
- Leave your phone behind, or turn it off, and save another one. Expect it to
  queue on the watch and sync once the phone is back, rather than losing your
  note.

## Reporting

One GitHub issue per bug. What you did, what happened, what you expected instead.
Include the OS version and whether it was iPhone, Mac or watch.

Screenshots help everywhere. On the watch, press the Digital Crown and the side
button together to take one. It lands in your phone's photos.

Anything merely annoying rather than broken is still worth an issue. A weight that
comes out wrong counts, and so does a screen that takes too long.
