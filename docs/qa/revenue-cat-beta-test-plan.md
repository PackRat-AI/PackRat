# PackRat Pro on iPhone: beta tester guide

PackRat Pro is the paid plan. This round is about the buying side of it: seeing which plan you are on, subscribing, restoring a purchase you already made, and managing the subscription afterwards.

Everything here comes from TestFlight, on the iPhone app.

Purchases are handled by the App Store rather than by PackRat, so much of this should feel like buying anything else on your phone. It is worth reporting anywhere it does not.

## Before you start

Note the OS version you are on. Every report needs to say where it happened.

This release covers the plan status in Settings, the upgrade flow, restoring purchases, and getting to the management screen.

Sign in before you start. The subscription screens need an account.

Being on Pro does not currently change what you can use. Everything in PackRat is available on the free plan, so the difference to look for is in the subscription screens themselves rather than in features appearing or disappearing. There is nothing to unlock yet.

You will not be charged. Purchases in a TestFlight build go through Apple's sandbox, so the money is not real, and subscriptions renew on a compressed timer rather than monthly or yearly. Use your normal Apple ID when the purchase sheet appears.

## Finding the subscription screens

Everything is in one place. Open the Profile tab, tap the gear icon to get into Settings, and scroll down to the section headed Subscription.

## Seeing your plan

- Open Settings and find the Subscription section. On a new account, expect "Free Plan" with "Upgrade to unlock Pro features" underneath it.
- Look at the icon beside it. A free account gets a grey outlined crown, and a Pro account gets a filled amber one.
- Force quit from the app switcher and open Settings again. Expect the same plan, not a flicker to the other one while it loads.

## Subscribing

- Tap "Upgrade to Pro". Expect a paywall to slide up from the bottom, listing the plans on offer with a price against each.
- Look at the prices. They should be in your local currency, and the longer plans should work out cheaper per month than the shortest one. Anything that reads as more expensive the longer you commit is worth reporting.
- Read the paywall text closely. The plan names and wording are configured outside the app rather than built into it, so a typo or a stale price here will not have been caught anywhere earlier.
- Back out of the paywall without buying. Expect to land back in Settings still on "Free Plan", with nothing charged and no error.
- Now buy one. The App Store sheet should appear, and after you confirm, expect the paywall to close on its own.
- Look at the Subscription section straight afterwards. Expect it to read "PackRat Pro" and "Full access to all Pro features" without you having to reopen the app or pull to refresh.
- Start a purchase and cancel at the App Store sheet instead of confirming. Expect to stay on "Free Plan" with no error shouted at you, since cancelling is a normal thing to do.
- Tap the buy button twice quickly. Expect one purchase, not two.

## Restoring a purchase

This matters for anyone reinstalling the app or moving to a new phone.

- While subscribed, delete the app, reinstall it from TestFlight and sign in again. Expect Settings to catch up to "PackRat Pro" on its own.
- If it still says "Free Plan", tap "Restore Purchases". Expect the label to change to "Restoring…" while it works, then an alert reading "Pro access restored!".
- Tap "Restore Purchases" on an account that never bought anything. Expect "No purchases found" rather than silence or a spinner that never ends.
- Turn on airplane mode and tap "Restore Purchases". Expect "Restore failed. Please try again." rather than the app appearing to hang.

## Managing a subscription

- While subscribed, tap "Manage Subscription". Expect to leave PackRat entirely and land on Apple's own subscription page, the same one you reach from your phone's settings. Leaving the app is intended here.
- Cancel the subscription there, then come back to PackRat. Expect to keep Pro until the period you paid for runs out, rather than losing it the moment you cancel.
- Once it has lapsed, expect Settings to drop back to "Free Plan" and the "Upgrade to Pro" row to return.

## Offline

PackRat works without a connection, and your subscription should not be the thing that breaks that.

- Use the app normally for a few minutes, then turn on airplane mode and open Settings. Expect your plan to still be shown rather than the section going blank or falling back to "Free Plan".
- Force quit while offline, reopen, and look again. Expect the plan to have survived the restart.
- While subscribed and offline, expect to keep Pro. Losing signal is not the same as cancelling.
- Tap "Upgrade to Pro" with no connection. Expect the paywall to say it cannot reach the store, rather than showing plans with no prices or an endless spinner.
- Turn airplane mode off and give it a moment. Expect the plan to settle to the right one without needing a restart.
- An orange banner reading "You're offline, showing cached data" should appear across the top while you have no connection, and disappear once you are back.

## Things that break apps

- Switch to dark mode and look over the Subscription section and the paywall again. Expect the prices and plan names to stay legible against the darker backgrounds.
- Turn the text size up in your phone's accessibility settings and reopen the paywall. Expect the plan names and prices to still fit rather than being cut off mid-word.
- Sign out and sign in as a different account. Expect the plan shown to be the one belonging to the account you are signed in as.

## Reporting

Reports go to GitHub issues as usual. Press the side button and volume up together for a screenshot. For anything involving a purchase, say which plan you picked and whether the App Store sheet appeared.

Anything merely annoying rather than broken is still worth reporting.
