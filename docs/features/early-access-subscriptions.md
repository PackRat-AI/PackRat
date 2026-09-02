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
features. Guests cannot subscribe — see ADR-006 — so a guest opening a gated
feature is returned to Home rather than shown a paywall they cannot act on.

**Someone whose subscription lapsed** loses access to features still inside
their window, and keeps every feature that has since graduated. They never lose
something that became free while they were paying.

## The paywall

Presented full screen when a signed-in free user opens a gated feature, and from
Settings via *Upgrade to Pro*.

It leads with an invitation to use the feature now, names the remaining window
as a head start ("42 days ahead of everyone else"), lists the other features
currently in early access, and offers the plans configured in RevenueCat with
prices in the viewer's own currency. The longest recurring plan is preselected
and marked best value.

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

## ADR-005 — The paywall sells the head start, not the schedule

**Decision.** The paywall never says "free for everyone in N days". Where the
window appears, it is framed as being ahead of others.

**Why.** An earlier version of the paywall led with the countdown to free. It is
accurate and it is also a direct argument to close the screen and wait — the
most prominent element was telling people not to buy.

**Consequence.** The honesty is preserved (the window is still stated, and the
graduation promise is real) while the emphasis is on acting now. Copy on this
screen is a conversion decision, not a description of the model.

## ADR-006 — Guests cannot subscribe

**Decision.** Subscribing requires an account. A guest opening a gated feature
is returned to Home; Settings shows *Sign in to subscribe* in place of the
upgrade action.

**Why.** A subscription is owned by an Apple ID, while access in PackRat is
owned by an account. A guest purchase has no account to attach to, which creates
a collision with no good answer: when that guest later signs into an existing
account that is not Pro, the subscription either follows the Apple ID and moves
off whichever account previously held it, or stays behind and leaves someone who
just paid looking at a paywall. Both outcomes are bad, and both would be
discovered by the user *after* taking their money.

Requiring sign-in first makes ownership unambiguous at the moment of purchase.

**Consequence.** One extra step before paying, which costs some conversion. This
was chosen knowingly: an unrecoverable "I paid and lost it" is worse than a
sign-in prompt, and refunds and support load are the alternative cost.

**Rejected alternative.** Allowing guest purchase and transferring the
entitlement on sign-in. This works when the guest creates a *new* account, and
breaks when they sign into an existing one — which cannot be detected until
after the purchase.

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
