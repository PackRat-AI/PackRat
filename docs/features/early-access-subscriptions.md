# Early access and PackRat Pro

How paid access works in PackRat: what a subscriber gets, what happens to
everyone else, and every product decision behind it.

## The model in one paragraph

PackRat Pro is a subscription. It does not buy features permanently — it buys
them **early**. A new feature ships to Pro members first, and after a set window
it becomes free for everyone. Nothing is ever taken away: a feature only ever
moves from Pro-first to free, never the other way.

## The two controls

Every feature has two independent switches, and both must allow it.

| Control | Question | Who changes it |
|---|---|---|
| Feature flag | Can this be on at all? | Engineering / admin — a kill switch |
| Feature access | Who may use it right now? | Product — the monetization layer |

A feature that is flagged off does not exist for anyone, subscriber or not. A
feature that is flagged on is then subject to its access rule.

Access is a single timestamp, `early_access_until`:

- **In the future** — early access. Pro members only.
- **In the past, or unset** — generally available. Free for everyone.

Graduation is automatic. Nobody flips a second switch when the window ends; the
same row simply starts resolving as free.

## What each person sees

**A Pro member** sees every feature that is flagged on. Early access is
invisible to them, which is the point of paying.

**A signed-in free user** sees generally-available features normally. Opening
one still in its early-access window presents the paywall. There is no
half-state: the feature either opens or the paywall does.

**A guest** (using the app without an account) sees generally-available
features. Opening a gated feature shows them the paywall in full; the call to
action routes to sign-in, because a subscription has to belong to an account —
see ADR-006. Once signed in they land back in the app and can subscribe.

**Someone whose subscription lapsed** loses access to features still inside
their window, and keeps every feature that has since graduated. They never lose
something that became free while they were paying.

## The paywall

Presented full screen when anyone without access opens a gated feature, and from
Settings via *Upgrade to Pro*. Guests see it too — the call to action routes
them to sign-in rather than the screen refusing to open.

It leads with the app icon and an invitation — *Unlock {feature} today* — says
the feature is in early access for Pro members, and lists what a subscription
gets: the other features currently in early access, new features weeks before
everyone else, that it supports a small team, and that it can be cancelled at
any time. Plans come from RevenueCat with prices in the viewer's own currency,
and the longest recurring plan is preselected and marked best value.

Dismissing it returns the viewer where they came from. A gated feature has no
content to show, so there is no locked screen to be left on.

## Restoring and managing

*Restore Purchases* recovers a subscription bought on another device or before a
reinstall, and is available to signed-in users in Settings. *Manage
Subscription* leaves the app for the platform's own subscription screen, which
is the only place a subscription can actually be cancelled.

## Offline

Subscription state is remembered on the device, so a paying member keeps access
with no connection. What is *not* remembered is treated as no access: if the app
has never successfully checked, a gated feature stays closed rather than being
opened on a guess.

The paywall itself needs a connection, since prices come from the store. Without
one it is not opened at all and the viewer is told plans could not be loaded.

---

# Decisions

## ADR-001 — Early access rather than permanent paid features

**Decision.** Paid access is a head start, not a permanent gate. Every gated
feature graduates to free on a set date.

**Why.** A hiking app's audience is not one that tolerates core planning tools
sitting behind a paywall forever, and permanently-paid features force a
recurring judgement about which side of the line each new thing falls on. A
window makes that judgement once, per feature, with an expiry.

**Consequence.** The pitch is urgency rather than exclusivity, and the paywall
must be written accordingly — see ADR-005. It also means the value of Pro decays
if new features stop shipping, which is a real obligation to keep the pipeline
full.

## ADR-002 — One timestamp, not a status field

**Decision.** Access state is a single `early_access_until` timestamp. There is
no "gated" / "released" enum.

**Why.** A status field needs something to flip it when the window ends — a job,
a cron, a person who remembers. Each of those can fail silently and leave a
feature paid past its promised date. A timestamp compared against now cannot
drift: the feature opens on schedule whether or not anyone is watching.

**Consequence.** There is no way to express "gated indefinitely" without setting
an absurd date, which is the intended constraint rather than a limitation.

## ADR-003 — Two controls instead of one

**Decision.** A feature flag and an access rule, both required.

**Why.** They answer different questions. The flag is a kill switch for
something broken; access is a product decision about who gets it. Collapsing
them means either turning a feature off for everyone to fix a billing question,
or being unable to switch off a feature that is misbehaving for Pro members.

**Consequence.** Every feature carries two entries, and both must be created for
the feature to work as intended. A flag with no access rule ships to whoever the
flag lets in, with no audience decision.

## ADR-004 — Unknown access means no access

**Decision.** Until the app has genuinely resolved whether someone is a
subscriber, gated features stay closed.

**Why.** The two failure modes are not equal. Wrongly showing a paywall to a
subscriber is an annoyance they can clear by retrying; wrongly opening a gated
feature gives away the thing being sold, silently, to everyone in that state.

**Consequence.** A cold start with no connection and nothing cached shows
"can't verify your access" rather than either outcome. That state is rare and
deliberately visible, since the alternative is guessing.

## ADR-005 — The paywall does not count down to free

**Decision.** The paywall states that the feature is in early access for Pro
members. It does not show how many days remain, in either direction — neither
"free for everyone in 42 days" nor "42 days ahead of everyone else".

**Why.** An early version led with the countdown to free. It is accurate, and it
is also a direct argument to close the screen and wait: the most prominent
element on a screen asking for money was telling people not to spend it.
Reframing the same number as a head start reads better but still puts a specific
deadline in front of someone deciding whether to pay, and invites them to weigh
waiting against buying.

**Consequence.** The graduation promise is still real and still documented; it is
simply not the paywall's argument. Copy on this screen is a conversion decision,
not a description of the pricing model.

## ADR-006 — Guests see the paywall; buying requires an account

**Decision.** A guest opening a gated feature gets the full paywall — the
feature, the plans, the prices. The call to action reads *Sign In to Subscribe*
and routes them into sign-in, after which they can buy. The restriction is on
*buying*, not on seeing the offer.

**Why.** Two constraints meet here.

A subscription is owned by an Apple ID; access in PackRat is owned by an
account. A purchase made with no account attaches to an anonymous identity, and
when that person later signs into an account that already exists, the
entitlement either follows the Apple ID and moves off whichever account held it,
or strands where nobody can reach it. Neither is discoverable until after the
money is taken. So the purchase call refuses to run while the store SDK is on an
anonymous identity, and the paywall sends guests to sign in before they reach
it.

The second constraint is that refusing to *show* the offer is a different thing
from refusing to take payment. Asking for an account before someone knows what
they would be buying inverts the order every subscription app uses, and App
Store guideline 5.1.1(v) is pointed about registration that is not tied to
account-specific functionality. Early access genuinely is account-specific, so
requiring sign-in at the point of purchase is defensible; requiring it to view a
price is not.

**Consequence.** One extra step between deciding to buy and buying, which costs
some conversion. Accepted: an unrecoverable "I paid and lost it" is worse, and
the alternative cost is refunds and support load.

**Rejected alternative — allow guest purchase, transfer on sign-in.** Works when
the guest creates a *new* account, breaks when they sign into an existing one,
and the difference cannot be detected until after the purchase.

**Rejected alternative — hide the paywall from guests.** Tried first. It left a
label reading "Sign in to subscribe" that told people what to do without letting
them do it, and bounced anyone opening a gated feature back to Home with no
explanation, which reads as a crash rather than a decision.

**Rejected alternative — refuse to initialise the store until sign-in.** Tried
second, on a misreading of RevenueCat's guidance. It does prevent anonymous
purchases, but prices come from the same connection, so guests got "Upgrades
Unavailable" instead of a paywall. The guidance about deferring initialisation
is really about background app prewarming creating junk customer records, which
is solved by initialising on first render rather than at launch — not by
withholding it from signed-out people.

## ADR-007 — Access rules are data, not releases

**Decision.** Which features are gated, and until when, lives in the database.
Changing it takes effect without shipping an app update.

**Why.** Deciding who gets a feature is a product call whose timing rarely
matches a release cycle. Tying it to app review means the decision is made weeks
early, by whoever wrote the code, and cannot be corrected quickly if it is wrong.

**Consequence.** Access can be changed at any time, including for features
already in people's hands. The graduation promise in ADR-001 constrains what
those changes may be: a window may be shortened, never extended in a way that
takes back access someone already has.
