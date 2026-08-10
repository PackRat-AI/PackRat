# Pack tools on iPhone: beta tester guide

Four new ways to work with a pack on the iPhone app: asking the assistant about
the pack you are in, adding gear from the catalog, scanning gear from a photo, and
ticking items off as you pack your bag.

These already exist on Android. This round is about the iPhone app, where all four
are new, so none of it has been through a beta pass yet.

## Before you start

Note the OS version you are on. Every report needs to say where it happened.

Sign in before you start. Three of the four tools need an account, and the guide
says where that matters.

Two things are worth having ready:

- A pack with real gear in it. Six to eight items across a few categories —
  shelter, sleep, clothing, kitchen — gives the weights and the progress counts
  something to work with. A nearly empty pack hides most of what these tools do.
- A photo of gear laid out on the floor or a bed, saved to your camera roll. Items
  spread out and not overlapping, in good light. Four to six recognisable things,
  like a tent, a jacket, a water bottle, a stove and a headtorch.

## Finding the tools

Open a pack. Everything below starts from the two buttons at the top right.

- Tap the `+` button. Expect a menu with exactly three entries: Add Manually, Scan
  Items from Photo, and Add from Catalog. One normal tap gets you there — pressing
  and holding should never be necessary to find them.
- Tap Add Manually. The pack item form should open, the same one that has always
  been there.
- Tap the `⋯` button. Expect Ask AI and Start Packing at the top, above Weight
  Analysis, Gap Analysis and Edit Pack.
- Open `⋯` on a pack with no items in it. Start Packing should be greyed out, and
  Ask AI should still work.

## Ask AI

This is the assistant, but pointed at the pack you are looking at rather than
starting from nothing.

- Open `⋯` then Ask AI on a pack with gear in it. Expect the screen to be titled
  Ask AI, with the pack's name as the heading and a greeting that names that pack.
- Look at the row of suggestions above the text box. They should be about the pack
  in front of you — What's missing, Cut weight, Heaviest items — rather than
  general packing prompts.
- Tap Heaviest items and read the whole answer. It should name actual items from
  your pack with roughly the right weights. This is the one to spend time on: an
  answer that talks in generalities and never names your gear is the failure worth
  reporting, and a screenshot of the full reply helps.
- Ask something specific of your own, like whether the pack is ready for rain.
  Expect the answer to refer to what is actually in it.
- Have a conversation in one pack, close it, then open Ask AI on a different pack.
  Expect a fresh conversation naming the second pack, with nothing carried over
  from the first.
- Leave the pack and open the Assistant tab at the bottom of the screen. That one
  should still be titled AI Assistant with its general suggestions, unaffected by
  any of the above.

## Add from Catalog

- Tap `+` then Add from Catalog. Expect gear on screen straight away rather than an
  empty state waiting for a search, along with a search box and a row of category
  buttons.
- Read the category buttons, scrolling sideways through all of them. Expect
  ordinary English — Hike & Camp, Footwear. Anything showing raw code like `&Amp;`
  or `&#39;` is a bug.
- Type "tent" and watch the list while it works. Expect the rows to dim with a
  spinner over them while the new results load, and pressing Return should not be
  necessary.
- Tap a category button, then tap the same one again. The first tap narrows the
  list to that category and the second clears it. Expect the same loading
  treatment as a search on both.
- Tap three different rows. Each should get a blue tick, a bar along the bottom
  should read "3 selected", and the button at the top right should read "Add (3)".
- Use the quantity stepper on a selected row. Expect the number to change, and not
  to go below 1.
- Tap Clear in the bottom bar. Every tick should clear, the bar should disappear,
  and Add should grey out.
- Select two or three items and tap Add. Expect the sheet to close, a brief line
  confirming how many were added, the items to appear in the pack, and the pack's
  total weight to go up.
- Add a single item with its quantity set to 3. It should land in the pack showing
  `×3`.
- Select some items and tap Cancel instead. The pack should be exactly as it was.
- Scroll to the bottom of the list with no search text. More gear should load on
  its own. Duplicate rows appearing is worth reporting.

## Scan Items from Photo

Use the gear photo from the setup above.

- Tap `+` then Scan Items from Photo. Expect a Scan Items screen that explains what
  the photo should look like, with a Choose Photo button.
- Choose your gear photo and wait. A spinner saying it is looking for gear should
  give way to a list of what it found. A screenshot of the results next to the
  original photo is the useful thing here, along with a note of how many it got
  right, missed, or invented.
- Look at the list when it first appears. Expect every item already ticked, with
  the full count on the button at the top right.
- Untick a couple. The count in the button should drop to match.
- Tap Select None, then Select All. The first clears every tick, the second
  restores them, and the button label swaps between the two each time.
- Read down the list. Items matched to the catalog should show a blue line with the
  product and its weight. Expect unmatched ones to say "No catalog match — weight
  not set" in orange. Both are normal, and the rough split between them is worth
  noting.
- Tick a few and tap Add. Expect the sheet to close, a line confirming the count,
  and the items to appear in the pack. Unmatched items arrive at 0 g, which is
  expected rather than a bug.
- Try a photo with no gear in it at all — a landscape, a pet, a wall. Expect a No
  Gear Detected screen offering another photo, not a crash, an endless spinner, or
  nonsense added to the pack.
- Tap Try Another Photo and pick a different image. It should analyse the new one
  normally.
- Start a scan and tap Cancel while the spinner is still going. The sheet should
  close and nothing should reach the pack.

## Start Packing

- Open `⋯` then Start Packing on a pack with several items. The screen should
  change: a progress card reading "0 of N packed" and 0%, a row of All, Unpacked
  and Packed buttons, a circle beside every item, a Done button at the top right,
  and Reset and Mark All Packed along the bottom. The weight charts should be
  hidden while you are packing.
- Look at Reset before ticking anything. It should be greyed out.
- Tap two or three items. Each should get a filled blue tick and fade slightly,
  and expect the count, the percentage and the progress bar to all move.
- Tap a ticked item again. It should untick and the count should drop.
- Tap Packed. Expect only the ticked items to remain, with the per-category counts
  updating to match.
- Tap Unpacked. Only the unticked ones should show, which is the list of what is
  left to pack.
- Tick everything, or use Mark All Packed, then tap Unpacked. Expect an
  "Everything's Packed" message rather than a blank screen or a prompt to add
  items.
- Tap Mark All Packed. Expect every item to tick, the bar to read 100%, and the
  button to grey out.
- Tap Reset. Everything should untick and the count should return to 0 of N.
- Tick about half the items and tap Done. Back on the pack screen, just under the
  weight charts, expect a card reading "Packing in progress" with the count.
  Tapping it should take you straight back in with your ticks intact.
- Force quit from the app switcher with some items ticked, then reopen and go back
  to that pack. The ticks should still be there.
- Tick items in one pack, then start packing a different one. The second should
  start at 0 of N with the first untouched.
- With four of ten ticked, leave packing mode, add an item from the catalog, then
  look at the progress. Expect four of eleven: the total goes up, the ticks stay,
  and the percentage never goes over 100%.
- Tick an item, leave packing mode, then delete that same item from the pack. The
  count should drop sensibly and should never show more packed than the pack holds.
- While packing, tap an item and try swiping a row sideways. Tapping should only
  tick and untick, never open the item for editing, and swipe to delete should not
  appear.

## Offline

PackRat works without a connection, and these four tools split cleanly on that.
Packing is kept on the device, so it works with no signal at all. The other three
need the network.

- Use the app for a few minutes so it has something cached, then turn on airplane
  mode and open a pack.
- Start Packing in airplane mode and tick items off. All of it should work exactly
  as it does online, including the progress card and the filters.
- Force quit while still in airplane mode, reopen, and go back to the pack. The
  ticks should have survived.
- Turn airplane mode off. Your packed items should still be as you left them.
- Open Add from Catalog in airplane mode. Expect it to say plainly that it cannot
  reach the network, rather than an endless spinner or an empty list with no
  explanation.
- Try Scan Items from Photo and Ask AI in airplane mode. Both should say clearly
  that a connection is needed.
- An orange banner reading "You're offline, showing cached data" should appear
  across the top while you have no connection, and disappear once you are back
  online.

Packed items stay on the device rather than on the account. Signing in on another
phone will not bring your ticks across, which is expected for now.

## Things that break apps

- Sign out, or use guest mode, and open Ask AI. Expect a clear message that an
  account is needed rather than a crash or an empty screen.
- Double tap Add on the catalog sheet, and tap items rapidly in packing mode.
  Expect no duplicated items, no wrong counts and no crash.
- Switch to dark mode and look over all four tools again. The text should stay
  legible against the darker backgrounds.
- Rotate the phone on each of them. Nothing should overlap or get cut off.
- Add an item with a very long name, over forty characters, then look at it in
  packing mode and in the catalog list. It should wrap or trim tidily.
- Run packing mode on a pack with thirty or more items. Scrolling should stay
  smooth and the progress count should stay accurate.

## Reporting

Reports go to GitHub issues as usual. Say which pack and how many items were in it,
since most of these tools behave differently on a full pack than an empty one.

Two things are worth a screenshot every time: any answer from Ask AI that does not
appear to know what is in the pack, and the results of a photo scan alongside the
photo that produced them.

A scanned item arriving at 0 g with no catalog match is expected, and each photo is
analysed once, so a second look at the same picture means choosing it again from the
camera roll.

Anything merely annoying rather than broken is still worth reporting.
