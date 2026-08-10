# Pack Tools (iOS) — Beta Tester Guide & Test Plan

Thanks for helping test the new pack tools! This guide walks you through everything to
try and how to report what you find. **You don't need to be technical** — every step is
something you can see and tap on your phone. If a step doesn't match what you see,
that's exactly the kind of thing we want to hear about.

> This is a **separate plan** from the PackRat Pro subscription guide
> (`revenuecat-beta-test-plan.md`). You don't need to have done that one first, and
> nothing here involves buying anything.

---

## 1. What you're testing

Four new tools inside a pack on the **iPhone app**. Until now you could only add gear to
a pack by typing it in by hand. Now there are three ways to add it and a way to tick it
off as you pack your bag:

| Tool | What it does |
|---|---|
| **Ask AI** | Chat about *this specific pack* — what's missing, how to cut weight |
| **Add from Catalog** | Search our gear catalog and add several items at once |
| **Scan Items from Photo** | Photograph your gear laid out; the app identifies it |
| **Start Packing** | Tick items off as you put them in your bag, with a progress bar |

These already exist in the Android/React Native app. This round is about the **iPhone
(Swift) app**, where they are brand new — so treat everything here as untested.

Your job: go through the tests, try to trip things up (tap fast, cancel halfway, go
offline), and tell us what you saw.

---

## 2. Before you start (one-time setup)

1. **Install the app.** Tap the build link we sent you, install it, and open it.
2. **Sign in to PackRat.** Use the test account we gave you, or create your own.
   Most of these tools need an account — see the note in Section 5.
3. **Make a pack with real gear in it.** Go to **Packs → New Pack**, then add at least
   **6–8 items** by hand across a few categories (shelter, sleep, clothing, kitchen).
   Several tests need a pack that isn't nearly empty.
4. **Have a gear photo ready.** For the scanning tests, take a photo of some real gear
   laid out on the floor or a bed — items spread out, not piled up, in good light.
   4–6 recognisable things is ideal (tent, jacket, water bottle, stove, headtorch).
   Save it to your camera roll before you start.
5. **Note your device.** At the top of your report, write your phone model and its
   software version (e.g. "iPhone 13, iOS 18.1").

> 💡 Nothing here costs money and nothing is permanent — you can delete any test pack
> afterwards.

---

## 3. How to report each test

For every test, copy this table into your report and fill it in:

| Field | Your answer |
|---|---|
| Test ID | (e.g. C3) |
| Result | Pass / Fail / Blocked / N-A |
| What you saw | (short description) |
| Screenshot | (attach one) |
| Device / OS | (e.g. iPhone 13, iOS 18.1) |
| Notes | (anything else) |

- **Please attach a screenshot on every failure**, and on **every screen the AI or the
  photo scanner produces** (even when it passes — we want to see what it said).
- "Blocked" means you couldn't even attempt the test (e.g. the app crashed before you got
  there). "N-A" means the test doesn't apply to your build.

---

## 4. The tests

Each test lists a **Setup** (the situation you should be in), the **Steps** to take, and
the **Expected result** (what should happen). Report anything different.

### A. Finding the new tools

**A1 — The Add Item menu has three choices**
- Setup: Open one of your packs.
- Steps: **Press and hold** the **+ (Add Item)** button in the top right.
- Expected: A menu appears with exactly three options: **Add Manually**, **Scan Items
  from Photo**, and **Add from Catalog**.

**A2 — A quick tap still adds by hand** 
- Setup: On a pack.
- Steps: **Tap** the **+** button normally (don't hold it).
- Expected: The **Add Item** form opens straight away — the same one you've always used.
  It should *not* make you pick from a menu first.

**A3 — The More menu has the new tools**
- Setup: On a pack.
- Steps: Tap the **⋯ (More)** button in the top right.
- Expected: The menu starts with **Ask AI** and **Start Packing**, followed by the
  existing Weight Analysis, Gap Analysis, and Edit Pack.

**A4 — Packing is unavailable on an empty pack**
- Setup: Create a brand-new pack and add **no** items.
- Steps: Open **⋯ (More)**.
- Expected: **Start Packing** is greyed out and can't be tapped. **Ask AI** is still
  available.

### B. Ask AI

**B1 — It knows which pack you're in** 📸 *screenshot required*
- Setup: On a pack that has gear in it.
- Steps: Open **⋯ → Ask AI**.
- Expected: A chat screen titled **Ask AI** opens. Your **pack's name** appears as the
  heading, and the greeting mentions that pack by name. Screenshot this.

**B2 — The suggested questions are about your pack**
- Setup: On the Ask AI screen.
- Steps: Look at the row of grey suggestion buttons above the text box.
- Expected: They are pack-specific — things like **"What's missing?"**, **"Cut weight"**,
  **"Heaviest items"** — not generic ones like "Ultralight tips" or "3-day hike gear".

**B3 — It can actually see your gear** 📸 *screenshot required*
- Setup: On the Ask AI screen for a pack with several items.
- Steps: Tap **"Heaviest items"** and wait for the full reply.
- Expected: The reply names **actual items from your pack** with roughly the right
  weights. This is the most important test on the page — if it answers in generalities
  and never names your gear, mark it **Fail** and screenshot the whole reply.

**B4 — Ask your own question**
- Setup: On the Ask AI screen.
- Steps: Type something specific, e.g. *"Am I ready for rain?"*, and send.
- Expected: A relevant answer that refers to your pack's contents.

**B5 — Each pack has its own conversation**
- Setup: Have a chat in Pack A, then close it.
- Steps: Open a **different** pack → **⋯ → Ask AI**.
- Expected: A fresh conversation greeting **Pack B** by name. Pack A's messages are
  **not** carried over.

**B6 — The general assistant still works**
- Setup: Leave the pack entirely.
- Steps: Tap the **Assistant** tab at the bottom of the screen.
- Expected: The normal assistant, titled **AI Assistant**, with the general suggestions
  ("Ultralight tips", etc.). It should be unaffected by anything above.

### C. Add from Catalog

**C1 — Browse without searching** 📸 *screenshot required*
- Setup: On a pack.
- Steps: Press and hold **+** → **Add from Catalog**.
- Expected: A sheet titled **Add from Catalog** opens **already showing gear** — you
  shouldn't have to search first to see anything. There's a search box and a row of
  category buttons. Screenshot it.

**C2 — Category names are written properly**
- Setup: On the catalog sheet.
- Steps: Read the category buttons, scrolling sideways through all of them.
- Expected: They read like normal English — **"Hike & Camp"**, **"Footwear"**. Report
  anything showing raw code such as `&Amp;`, `&amp;`, or `&#39;`.

**C3 — Search finds things**
- Setup: On the catalog sheet.
- Steps: Type **tent** and wait a moment (it searches on its own after you stop typing).
- Expected: The list updates to tents. You shouldn't need to press Return.

**C4 — Filter by category**
- Setup: On the catalog sheet.
- Steps: Tap a category button, then tap the same one again.
- Expected: First tap narrows the list to that category; second tap clears the filter.

**C5 — Select several items at once**
- Setup: On the catalog sheet.
- Steps: Tap **three** different items (tap the row, not the small stepper).
- Expected: Each shows a blue tick, a bar at the bottom says **"3 selected"**, and the
  top-right button reads **Add (3)**.

**C6 — Change how many of something**
- Setup: With at least one item selected.
- Steps: On a selected row, use the **Quantity** +/− stepper.
- Expected: The number changes and won't go below 1.

**C7 — Clear the selection**
- Setup: With several items selected.
- Steps: Tap **Clear** in the bottom bar.
- Expected: All ticks clear, the bottom bar disappears, and **Add** greys out.

**C8 — Add them to the pack**
- Setup: With 2–3 items selected.
- Steps: Tap **Add (n)**.
- Expected: The sheet closes, a brief message says how many were added, and the new items
  appear in your pack. The pack's **total weight goes up**.

**C9 — Quantity is respected**
- Setup: Add a single item with the quantity set to **3**.
- Expected: The item appears in the pack showing **×3**.

**C10 — Cancel adds nothing**
- Setup: On the catalog sheet with items selected.
- Steps: Tap **Cancel**.
- Expected: The sheet closes and your pack is **unchanged**.

**C11 — Scrolling loads more**
- Setup: On the catalog sheet with no search text.
- Steps: Scroll to the bottom of the list.
- Expected: More gear loads automatically. Report any **duplicate items** appearing.

### D. Scan Items from Photo

> Use the gear photo you prepared in setup.

**D1 — The starting screen explains itself**
- Setup: On a pack.
- Steps: Press and hold **+** → **Scan Items from Photo**.
- Expected: A sheet titled **Scan Items** explaining what to do, with a **Choose Photo**
  button.

**D2 — It identifies your gear** 📸 *screenshot required*
- Setup: On the Scan Items sheet.
- Steps: Tap **Choose Photo**, pick your gear photo, and wait.
- Expected: A spinner saying it's looking for gear, then a list of detected items.
  Screenshot the results **next to** (or alongside) your original photo so we can judge
  accuracy. Tell us how many it got right, missed, or invented.

**D3 — Everything starts ticked**
- Setup: On the results list.
- Expected: Every detected item already has a blue tick, and the top-right button shows
  the full count, e.g. **Add (5)**.

**D4 — Untick what you don't want**
- Setup: On the results list.
- Steps: Tap a couple of items to untick them.
- Expected: The ticks clear and the **Add (n)** count drops to match.

**D5 — Select All / Select None**
- Setup: On the results list.
- Steps: Tap the **Select None** / **Select All** button in the list header, twice.
- Expected: It clears everything, then re-selects everything, and the label swaps between
  the two each time.

**D6 — Matched vs unmatched items are marked**
- Setup: On the results list.
- Expected: Items we recognised show a **blue link line** with a catalog product and its
  weight. Items we didn't show an **orange "No catalog match — weight not set"**. Both
  are normal; we want to know the rough split.

**D7 — Add them to the pack**
- Setup: With a few items ticked.
- Steps: Tap **Add (n)**.
- Expected: The sheet closes, a message confirms how many were added, and they appear in
  the pack. Unmatched ones will show **0 g** — that's expected, you'd set the weight
  yourself later.

**D8 — A photo with no gear in it**
- Setup: On the Scan Items sheet.
- Steps: Choose a photo with no gear at all (a landscape, a pet, a wall).
- Expected: A friendly **"No Gear Detected"** screen offering to try another photo. It
  must **not** crash, hang forever, or add nonsense to your pack.

**D9 — Trying again needs a new photo**
- Setup: After any scan.
- Steps: Tap **Try Another Photo** and pick a different image.
- Expected: It analyses the new photo normally. (Behind the scenes each photo can only be
  analysed once — so this is worth confirming.)

**D10 — Cancel mid-scan**
- Setup: Start a scan and tap **Cancel** while the spinner is still going.
- Expected: The sheet closes cleanly and nothing is added to your pack.

### E. Start Packing

**E1 — Entering packing mode** 📸 *screenshot required*
- Setup: On a pack with several items.
- Steps: Tap **⋯ → Start Packing**.
- Expected: The screen changes: a progress card at the top reading **"0 of N packed / 0%"**,
  a row of **All / Unpacked / Packed** buttons, a **circle** beside every item, a
  **Done** button top-right, and a bottom bar with **Reset** and **Mark All Packed**.
  The weight charts are hidden while packing. Screenshot it.

**E2 — Reset starts disabled**
- Setup: Just entered packing mode with nothing ticked.
- Expected: **Reset** is greyed out.

**E3 — Tick items off**
- Setup: In packing mode.
- Steps: Tap two or three items.
- Expected: Each gets a filled blue tick and **fades slightly**. The counter and
  percentage go up, and the progress bar grows.

**E4 — Untick an item**
- Setup: With items ticked.
- Steps: Tap a ticked item again.
- Expected: It un-ticks and the count goes back down.

**E5 — The Packed filter**
- Setup: In packing mode with some items ticked.
- Steps: Tap **Packed**.
- Expected: Only ticked items remain on screen, and the per-category counts update to
  match.

**E6 — The Unpacked filter**
- Steps: Tap **Unpacked**.
- Expected: Only un-ticked items show — this is your "what's left" list.

**E7 — An empty filter explains itself**
- Setup: Tick **every** item (or use **Mark All Packed**), then tap **Unpacked**.
- Expected: A friendly **"Everything's Packed"** message — not a blank screen, and not an
  "Add Item" prompt.

**E8 — Mark All Packed**
- Setup: In packing mode.
- Steps: Tap **Mark All Packed**.
- Expected: Every item ticks, the bar reads **100%**, and the button greys out.

**E9 — Reset**
- Setup: With items ticked.
- Steps: Tap **Reset**.
- Expected: Everything un-ticks and the counter returns to **0 of N**.

**E10 — Leaving and coming back remembers your progress** 📸 *screenshot required*
- Setup: Tick about half the items, then tap **Done**.
- Steps: You're back on the normal pack screen. Look just under the weight charts.
- Expected: A card reading **"Packing in progress — X of N items checked off"**. Tapping
  it takes you straight back into packing mode with your ticks intact. Screenshot the card.

**E11 — It survives closing the app**
- Setup: With some items ticked, **fully close** the app (swipe it away) and reopen it.
- Steps: Go back to that pack.
- Expected: Your ticks are still there.

**E12 — Each pack is tracked separately**
- Setup: Tick items in Pack A.
- Steps: Open Pack B and start packing.
- Expected: Pack B starts at **0 of N**. Pack A's progress is untouched.

**E13 — Adding gear mid-pack doesn't break the count**
- Setup: In a pack with, say, 4 of 10 ticked.
- Steps: Leave packing mode, add an item from the catalog, then look at the progress.
- Expected: It becomes **4 of 11** — the total goes up, your ticks are kept, and the
  percentage **never exceeds 100%**.

**E14 — Deleting a packed item doesn't break the count**
- Setup: Tick an item, leave packing mode, then delete that same item from the pack.
- Expected: The count drops sensibly and **never shows more packed than the pack holds**
  (e.g. never "5 of 4").

**E15 — No accidental edits while packing**
- Setup: In packing mode.
- Steps: Try tapping an item, and try swiping a row sideways.
- Expected: Tapping only ticks/unticks — it must **not** open the item's edit screen.
  Swipe-to-delete should not appear.

### F. Rough edges (please try to break it)

**F1 — Offline**
- Setup: Turn on Airplane Mode.
- Steps: Try each of the four tools.
- Expected: **Start Packing works fully offline** (it's stored on your phone). The other
  three need a connection and should say so **politely** — no crash, no endless spinner,
  no silent nothing.

**F2 — Signed out**
- Setup: Sign out (or use Guest mode).
- Steps: Try **Ask AI**.
- Expected: A clear message that an account is needed — not a crash or an empty screen.

**F3 — Tap things twice, fast**
- Steps: Double-tap **Add** on the catalog sheet; double-tap items rapidly in packing mode.
- Expected: No duplicated items, no wrong counts, no crash.

**F4 — Dark mode & rotation**
- Steps: View all four tools in **dark mode**, and rotate the phone.
- Expected: Everything is readable and correctly laid out. Nothing overlaps or gets cut off.

**F5 — Very long names**
- Setup: Add an item with a very long name (40+ characters).
- Expected: It wraps or trims tidily in packing mode and in the catalog list.

**F6 — A big pack**
- Setup: A pack with **30+** items.
- Expected: Packing mode still scrolls smoothly and the progress bar stays accurate.

---

## 5. Things to know up front (so you don't report false alarms)

- **Packing progress lives on your phone, not your account.** If you sign in on a
  different device, your ticks won't follow you. That's by design for now — please don't
  report it as a bug.
- **Scanned items with no catalog match arrive at 0 g.** The photo tells us *what* the
  gear is but not what it weighs, so you fill the weight in yourself. Expected, not a bug.
- **Each photo is analysed once.** Scanning the same picture again means picking it fresh
  from your camera roll.
- **The AI can be wrong.** We're testing whether it can *see your actual pack contents*,
  not whether its advice is perfect. Bad advice about real items = interesting. Confident
  talk about gear you don't own = a bug worth reporting.
- **A quick tap on + is meant to skip the menu** and go straight to the manual form.
  That's deliberate.

---

## 6. Final summary sheet

| Test ID | Result (Pass / Fail / Blocked / N-A) | Notes |
|---|---|---|
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |
| B5 | | |
| B6 | | |
| C1 | | |
| C2 | | |
| C3 | | |
| C4 | | |
| C5 | | |
| C6 | | |
| C7 | | |
| C8 | | |
| C9 | | |
| C10 | | |
| C11 | | |
| D1 | | |
| D2 | | |
| D3 | | |
| D4 | | |
| D5 | | |
| D6 | | |
| D7 | | |
| D8 | | |
| D9 | | |
| D10 | | |
| E1 | | |
| E2 | | |
| E3 | | |
| E4 | | |
| E5 | | |
| E6 | | |
| E7 | | |
| E8 | | |
| E9 | | |
| E10 | | |
| E11 | | |
| E12 | | |
| E13 | | |
| E14 | | |
| E15 | | |
| F1 | | |
| F2 | | |
| F3 | | |
| F4 | | |
| F5 | | |
| F6 | | |

**🚨 Showstoppers** — list anything here that:
- lost gear from a pack, or lost your packing progress, or
- added items you never asked for, or
- crashed the app, or
- left you stuck on a screen you couldn't get out of.

**Also worth flagging separately:**
- Photo scans that were mostly wrong (tell us what was in the photo).
- AI answers that clearly couldn't see your pack.

Thank you! 🎒
