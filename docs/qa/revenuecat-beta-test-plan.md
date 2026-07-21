# PackRat Pro — Beta Tester Guide & Test Plan

Thank you for helping test PackRat Pro! This guide walks you through everything to try
and how to report what you find. **You don't need to be technical** — every step is
something you can see and tap on your phone. If a step doesn't match what you see,
that's exactly the kind of thing we want to hear about.

---

## 1. What you're testing

**PackRat Pro** is our new paid subscription. This round of testing is all about the
buying experience: subscribing, restoring a past purchase, and managing a subscription.

A few things to know:

- There is **one paid plan** — PackRat Pro. Everyone else is on the **Free** plan.
- Some brand-new features are offered as **"early access"** — Pro members get them first
  for a few weeks, and then they become free for everyone. **Nothing is ever taken away
  from free users.** Features only go from "Pro gets it first" to "free for all."
- **You will not be charged real money.** You'll be given a special test store account
  so all purchases are fake. (See setup below.)

Your job: go through the tests, try to trip things up (tap fast, cancel halfway, go
offline), and tell us what you saw.

---

## 2. Before you start (one-time setup)

Please complete this checklist once before testing:

1. **Install the app.** Tap the build link we sent you, install it, and open it.
2. **Sign in to PackRat.** Use the test account we gave you, or create your own account
   in the app.
3. **Set up the test store account for buying. This is important — do not use your own
   real store account to buy.**
   - **iPhone/iPad:** When you start a purchase for the first time, the App Store will
     ask you to sign in. Sign in with the **sandbox (test) Apple ID** we provided — not
     your personal one. You do not need to sign out of your real Apple ID beforehand;
     just use the test one when the purchase prompt appears.
   - **Android:** Make sure the Google account on your phone is one we've added to the
     tester list. Let us know your Google email if you're unsure.
4. **Find Settings.** Open the app's **Settings** and confirm you can see a
   **Subscription** section. This is where most tests happen.
5. **Note your device.** At the top of your report, write your phone model and its
   software version (e.g. "iPhone 13, iOS 18.1" or "Pixel 7, Android 15").

> 💡 Reassurance: These are test purchases. No real card is charged. Please go ahead and
> complete purchases when a test asks you to — that's how we test the full flow.

---

## 3. How to report each test

For every test, copy this little table into your report and fill it in:

| Field | Your answer |
|---|---|
| Test ID | (e.g. A3) |
| Result | Pass / Fail / Blocked / N-A |
| What you saw | (short description) |
| Screenshot | (attach one) |
| Device / OS | (e.g. iPhone 13, iOS 18.1) |
| Notes | (anything else) |

- **Please attach a screenshot on every failure**, and on **every price/paywall screen**
  (even when it passes — we want to see the prices you saw).
- "Blocked" means you couldn't even attempt the test (e.g. the app crashed before you got
  there). "N-A" means the test doesn't apply to your build (see Section 4G).

---

## 4. The tests

Each test lists a **Setup** (the situation you should be in), the **Steps** to take, and
the **Expected result** (what should happen). Report anything different.

### A. Finding the subscription options (as a Free user)

**A1 — See your plan status**
- Setup: Signed in with a Free (non-paying) account.
- Steps: Open Settings → Subscription.
- Expected: It shows **"Free Plan"** and a message inviting you to upgrade
  (e.g. "Upgrade to unlock Pro features").

**A2 — Open the paywall**
- Setup: On the Subscription screen as a Free user.
- Steps: Tap **"Upgrade to Pro."**
- Expected: A subscription screen slides up (like a pop-up/modal).

**A3 — The paywall shows real options** 📸 *screenshot required*
- Setup: On the paywall.
- Steps: Look at the options offered.
- Expected: You see purchase options with **prices in your local currency**. Confirm you
  can see the different plans offered (for example **Monthly, Annual, and Lifetime**),
  each with a price. Screenshot the whole screen.

**A4 — Free trial / intro offer wording** 📸 *screenshot if shown*
- Setup: On the paywall.
- Steps: Read the wording around any free trial or discounted intro price.
- Expected: If a trial or intro price is offered, it's **clear when billing starts and
  how much** you'll be charged after. If nothing like this is shown, mark N-A.

**A5 — Close without buying**
- Setup: On the paywall.
- Steps: Tap the **X** or swipe it away without buying.
- Expected: You return to Settings, still on **Free Plan**. Nothing was purchased.

### B. Buying Pro (the happy path)

> Use your **test store account** for all of these. Prices are fake.

**B1 — Buy the Monthly plan**
- Setup: Free user, on the paywall.
- Steps: Choose **Monthly** → complete the purchase in the store pop-up.
- Expected: The paywall closes and Settings now shows **"PackRat Pro"** with a crown and
  "Full access to all Pro features."

**B2 — Buy the Annual plan**
- Setup: A Free account on the paywall. (Use a fresh test account if you can, or cancel
  the Monthly first — see the note under Section E.)
- Steps: Choose **Annual/Yearly** → complete the purchase.
- Expected: Status becomes **PackRat Pro**.

**B3 — Buy the Lifetime option**
- Setup: A Free account on the paywall.
- Steps: Choose **Lifetime** → complete the purchase.
- Expected: Status becomes **PackRat Pro**.

**B4 — Pro status sticks after restarting the app**
- Setup: Just purchased Pro (any plan).
- Steps: Fully close the app (swipe it away) and reopen it → go to Settings.
- Expected: Still shows **PackRat Pro**. You should not have to buy again.

### C. Cancelling or declining a purchase

**C1 — Cancel at the store pop-up**
- Setup: Free user, on the paywall.
- Steps: Start a purchase, then **cancel** at the store's confirmation dialog.
- Expected: You return to the paywall or Settings, still on **Free Plan**, no charge, and
  the app does not crash or show a scary error.

**C2 — A payment that doesn't go through**
- Setup: If you're able to make a test purchase fail (ask us how for your device).
- Steps: Attempt the failing purchase.
- Expected: A **clear, friendly error message** appears and the app stays usable. If you
  can't force a failure, mark N-A.

### D. Restore Purchases

**D1 — Restore when you already have Pro**
- Setup: A test account that already bought Pro.
- Steps: Reinstall the app (or sign in on a second device) → Settings →
  **Restore Purchases.**
- Expected: A success message like **"Pro access restored!"** and status becomes Pro.

**D2 — Restore when there's nothing to restore**
- Setup: A Free account that has never purchased.
- Steps: Settings → **Restore Purchases.**
- Expected: A message like **"No purchases found."** You stay on Free.

**D3 — The Restore button gives feedback**
- Setup: On the Subscription screen.
- Steps: Tap **Restore Purchases** and watch the button.
- Expected: It shows a **"Restoring…"** state while it works and doesn't let you spam-tap
  it.

### E. Managing a subscription (as a Pro user)

**E1 — The Manage Subscription link**
- Setup: Signed in as a Pro user.
- Steps: Settings → **Manage Subscription.**
- Expected: It opens your **phone's own subscription page** (App Store subscriptions on
  iPhone, Google Play subscriptions on Android) and PackRat is listed there.

**E2 — Cancel from the store**
- Setup: On that store subscription page as a Pro user.
- Steps: Cancel the PackRat subscription there, then return to the app.
- Expected: Your Pro access should **continue until the end of the period you paid for** —
  the app should **not** immediately lock you out the moment you cancel.

### F. Account & sign-in checks

**F1 — Pro follows the account, not the phone**
- Setup: Pro account signed in.
- Steps: Log out, then log back in with the **same** account.
- Expected: You're still shown as **Pro**.

**F2 — A different account correctly shows Free**
- Setup: On a phone where a Pro account was used.
- Steps: Sign in with a **different, non-paying** account.
- Expected: That account shows **Free Plan** (Pro doesn't "leak" to other accounts on the
  same phone).

### G. Early-access features — *may not be in your build yet*

> ⚠️ **Please read:** These features may **not be reachable** in the build you have. If
> you can't find any feature that shows a paywall or an "early access" message, mark all
> of these **N-A — not in build**. We've included them so you know what to look for once
> they go live. We'll tell you when they're ready.

**G1 — A Pro member uses an early-access feature normally**
- Expected: The feature just works, with no paywall interruption.

**G2 — A Free member hits an early-access feature**
- Expected: A paywall appears automatically. If you cancel it, you go back to where you
  were.

**G3 — The countdown wording** 📸 *screenshot the wording*
- Expected: The early-access paywall tells you **how many days** until this feature
  becomes free for everyone, and may list other features currently in early access.

**G4 — Going offline at an early-access feature**
- Setup: Turn on **airplane mode.**
- Steps: Open an early-access feature.
- Expected: You see an **"You're offline"** / **"Can't verify your access"** message with
  **Try again** and **Go back** buttons — **not** a paywall. Turn wifi back on, tap
  **Try again**, and it should recover.

**G5 — A paying user offline is never wrongly blocked**
- Setup: A **Pro** account, phone offline (airplane mode), app freshly opened.
- Steps: Open an early-access feature.
- Expected: You should **never** be asked to pay again for something you already own. At
  worst you see a "Can't verify" message — never a demand to buy.

**G6 — A feature "graduates" to free**
- Note: This is a slow one that we may set up specially for you. When a feature's
  early-access window ends, it should become available to **free** users **without any
  app update.**

### H. Try to break it

**H1 — Rapid tapping**
- Steps: Double- and triple-tap the **Upgrade**, **Restore**, and purchase buttons.
- Expected: No duplicate purchases, no double paywalls, no crash.

**H2 — Interruptions mid-purchase**
- Steps: Start a purchase, then switch to another app or take a call, then come back.
- Expected: The app recovers to a sensible state (not stuck, not crashed).

**H3 — Dark mode & rotation**
- Steps: View the paywall and Settings in **dark mode**, and rotate the phone if it
  supports rotation.
- Expected: Everything is readable and laid out correctly.

---

## 5. Things to know up front (so you don't report false alarms)

- **Early-access tests (Section G) may be N-A** in your build — that's expected for now.
- There is **no in-app "cancel subscription" screen** beyond the link that sends you to
  your phone's store page. Don't go hunting for one — using the store page is the
  intended way to manage or cancel.
- **Prices, trials, and exactly which plans appear can change** and may differ from this
  guide. Always **trust what the live paywall screen shows you** and screenshot it.

---

## 6. Final summary sheet

At the end, please fill in this summary so we can see everything at a glance:

| Test ID | Result (Pass / Fail / Blocked / N-A) | Notes |
|---|---|---|
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| A5 | | |
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |
| C1 | | |
| C2 | | |
| D1 | | |
| D2 | | |
| D3 | | |
| E1 | | |
| E2 | | |
| F1 | | |
| F2 | | |
| G1 | | |
| G2 | | |
| G3 | | |
| G4 | | |
| G5 | | |
| G6 | | |
| H1 | | |
| H2 | | |
| H3 | | |

**🚨 Showstoppers** — list anything here that:
- stopped you from buying, or
- stopped you from restoring a purchase, or
- charged you (even a test charge) incorrectly, or
- blocked access to something you had paid for.

Thank you! 🎒
