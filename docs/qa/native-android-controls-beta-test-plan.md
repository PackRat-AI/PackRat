# Native Android Controls — Beta Tester Guide & Test Plan

**Build:** `feat/expo-ui-migration-sdk57` · **Platform: Android only** · Expo SDK 57

We replaced a chunk of PackRat's hand-built interface controls with the real Android
ones — the same switches, dialogs, menus and pickers the operating system uses.

Nothing about *what* the app does has changed. Every screen should do exactly what it
did before. What changes is how these controls look, animate and feel: they should now
match the rest of your phone.

**We need you to confirm nothing broke.** These controls sit on top of real
actions — deleting packs, confirming your account, saving trip dates — so a subtle
failure matters more than usual.

---

## What to check, and what "correct" looks like

Work through whichever of these you normally use. For each one, the question is the
same: **does it still do the thing it says it does?**

### 1. Bottom sheets — the panels that slide up

**Where:** Pack detail (the `⋯` menu), adding a pack item, choosing a trip location,
the AI chat mode picker, pack template options.

- Does it slide up when you tap the thing that opens it?
- **Can you close it?** Try three ways: swipe it down, tap the dimmed area above it,
  and press the Android back button. *All three should close it.*
- If closing it was supposed to do something — like actually deleting an item you
  confirmed — did that thing happen?

> **This is the highest-priority check.** We found and fixed a bug during development
> where two sheets could not be closed at all. Please be thorough here.

### 2. Confirmation dialogs

**Where:** Sign-in and sign-up errors, delete a pack, delete your account, the
`⋯` menus on the dashboard tiles (Weight Analysis, Gear Inventory, Pack Stats).

- The dialog should look like a standard Android dialog now.
- **Both buttons must work.** Cancel should cancel and change nothing. The confirm
  button should do exactly what it says.
- The back button should dismiss it the same as Cancel.
- **Deleting your account** still asks you to type a confirmation. That flow is
  unchanged — please check it still works if you have a spare test account.

### 3. Overflow menus (`⋯` and `☰`)

**Where:** Messages screen (the `☰` at top-left), chat threads.

- Tap it: a menu should appear anchored to the button.
- Every item should still perform its own action — check at least two.
- Tapping outside or pressing back should close it without doing anything.
- **Known and expected:** some menu items show a `?` where an icon should be. That
  also happens on the current release — it is not new, and we are tracking it
  separately. No need to report it.

### 4. Switches, checkboxes and segmented buttons

**Where:** Settings (Display Units), Notification preferences, Weather alert
preferences, "Show password" on sign-up and password reset, the filter tabs on Packs
and Templates.

- **The switches are noticeably bigger than before.** That is intentional — it is the
  standard Android size. Not a bug.
- Flip one, leave the screen, come back: did it remember?
- Does the setting actually take effect?
- Tap targets should still be easy to hit. Tell us if any feel small or fiddly.

### 5. Date picker

**Where:** Create or edit a trip — Start Date and End Date.

- Tapping the field should open an Android calendar.
- Pick a date, tap OK: the field should show that date.
- Tap Cancel: nothing should change.
- Save the trip, reopen it — is the date still right?

### 6. Cards

**Where:** Gear catalog items, Guides, Trip detail, AI chat responses.

- Text should be fully visible, not cut off or overlapping.
- Nothing should spill outside the card's edges.
- Buttons inside cards should still be tappable.

---

## How to report something

Please include:

1. **Which screen** and what you tapped
2. **What you expected** vs what happened
3. **A screenshot or screen recording** — most valuable for anything visual
4. **Your phone model and Android version**

### Please flag these immediately

- A sheet or dialog you **cannot close**
- A button that does **nothing**
- A button that does the **wrong thing** — especially anything that deletes
- Text you cannot read, or a control you cannot tap
- A setting that does not stick

### Please don't report these — they are known and expected

- Switches being larger than before
- `?` instead of an icon in overflow menus (also in the current release)
- Dialogs and menus looking more "Android-standard" than before — that is the goal

---

## Notes

**Android only.** iPhone is unaffected by this build.

**"Looks different" is usually correct here.** These controls are meant to look like
Android now. If something looks unfamiliar but works, mention it but don't treat it as
broken — we'd rather hear it than not, and we'll judge whether it was intended.

**If in doubt, report it.** A duplicate is cheap; a broken delete button that reaches
release is not.

Thank you — the parts we most need human eyes on are exactly the ones that are hard to
test automatically: does it feel right, and does it still do what you meant.
