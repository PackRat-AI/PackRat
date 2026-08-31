# Access decisions

Every new user-facing feature needs a human to decide who gets it before it can
merge. Nothing else does.

## The convention

**Every new feature gets both gates. No exceptions.**

| Gate | Question it answers | Where it lives |
|---|---|---|
| Feature flag | Can this be on at all? | `FeatureFlag` in `packages/config/src/config.ts` |
| `feature_access` key | Who is allowed to use it? | the `feature_access` table |

These are different questions and one does not substitute for the other. A flag
with no access row ships to whoever the flag lets in, with nobody having decided
that. An access row with no flag cannot be switched off if it misbehaves. Half a
gate is the failure mode this convention exists to remove.

Two rules make it checkable rather than a matter of memory:

**1. The names are paired by rule.** Drop the `enable` prefix, kebab-case the
rest:

```
enableSummitLog               → summit-log
enableTrips                   → trips
enableWildlifeIdentification  → wildlife-identification
enableLocalAI                 → local-ai      (a capital run is one word)
enableOAuth                   → oauth
```

`featureAccessKeyForFlag` in `packages/config/src/featureKeys.ts` is the single
implementation; CI re-derives the name and rejects a `feature-key` that does not
match the flag added in the same PR.

**2. A new flag defaults to `false`.** A new feature ships dark and is turned on
deliberately. A flag whose default is added as `true` is on for everyone the
moment it merges — the undecided rollout this whole mechanism is meant to
prevent, and unlike a missing audience, no later edit to the PR body undoes it.
CI fails the PR outright.

One pre-existing exception: the only live server-side gate uses the access key
`'wildlife'` (hardcoded at `packages/api/src/routes/wildlife/index.ts:33`) for a
feature whose flag is `enableWildlifeIdentification`. Under the rule above it
would be `wildlife-identification`. It predates the convention; leave it unless
you are already touching that route.

That second sentence is the point. Most work in this repo is fixes, refactors
and polish, and none of it should have to pass a product gate. The mechanism
below is designed to stay invisible on those PRs and only speak up when a
genuinely new feature appears.

## Why this exists

Without a gate, a new feature merges in whatever state its flag happened to be
left in. Sometimes that means shipping to everyone before anyone decided it
should. The decision gets made by default, silently, by whoever wrote the last
line of code.

This makes the decision explicit and puts it with a human. The entitlement
database stays the single source of truth for who can access what; GitHub is
only the controlled input that writes to it.

## Who decides what

| Actor | Responsibility |
|---|---|
| **Coding agent** | Classifies the PR: does it add a new user-facing feature, yes or no. Surfaces that a decision is owed. |
| **Human** | Chooses the audience — everyone, or Pro-first for a set window. |
| **CI** | Validates the declaration, blocks merge until it is complete, writes the result to `feature_access`. |

**An agent never chooses the audience.** Not as a suggestion, not as a default,
not as a "recommended" value in the PR body. That is a product judgement about
who pays for what, and it belongs to a person. An agent that proposes a tier is
making the decision and asking for a rubber stamp, which defeats the mechanism.

## What counts as a new user-facing feature

Yes:

- A new screen, tab, or route a user can reach
- A new capability on an existing screen that a user would notice and describe
  as new ("it can identify wildlife now")
- A new feature flag key in `packages/config/src/config.ts`

No:

- Bug fixes, including user-visible ones
- Refactors, renames, dependency bumps, test changes, docs
- Performance and polish work on something that already shipped
- Wiring, plumbing, or infrastructure with no user-visible surface
- Flipping an *existing* flag's default — that decision was already made once;
  changing it is a normal change, not a new feature

**When unsure, declare `new-feature`.** The gate is designed to be cheap to
clear: a false positive costs one edit to the PR description. A false negative
ships a feature nobody ruled on. These are not symmetric, so bias toward
gating.

## The declaration block

Add this to the PR description. The agent fills in `declaration:`; a human fills
in the rest when the declaration is `new-feature`.

For a PR with no new feature:

```
## Access decision
declaration: none
```

For a new feature, before a human has decided — this state **blocks merge**,
which is intentional:

```
## Access decision
declaration: new-feature
```

After the human decides. Free for everyone from day one:

```
## Access decision
declaration: new-feature
audience: everyone
feature-key: summit-log
```

Or Pro members first, until the window passes:

```
## Access decision
declaration: new-feature
audience: early-access
feature-key: summit-log
expiry: 2026-10-15
```

Field notes:

- `feature-key` is the `feature_access` table key. It is its own namespace and
  is **not** the same as a `FeatureFlag` key — `wildlife`, not
  `enableWildlifeIdentification`.
- `expiry` is required for `early-access` and must be omitted for `everyone`.
  General availability has no window.
- After `expiry` passes, the feature becomes free for everyone automatically.
  There is no second flip to remember and nothing is taken away from anyone —
  a feature only ever moves from Pro-first to free.

## How the check behaves

`scripts/lint/detect-access-decisions.ts` runs on every PR:

1. Reads the diff for new `FeatureFlag` keys — the deterministic signal.
2. Reads the declaration block from the PR body.
3. Passes only when no new feature was detected and none was declared, or when
   a complete, valid decision is present.

It fails toward the gate. A diff it cannot read, a block it cannot parse, or a
`none` declaration contradicted by a new flag key in the diff all block rather
than wave through.

One case worth calling out: declaring `none` while the diff adds a new flag key
fails. The diff wins. A fix or refactor does not introduce a feature flag, so
that combination means the classification is wrong.

## Instructions for coding agents

When you open a PR:

1. Decide whether the work adds a new user-facing feature, using the lists
   above. When genuinely unsure, choose `new-feature`.
2. If it is a new feature, add **both** gates as part of building it: a
   `FeatureFlag` key defaulting to `false`, and the matching `feature_access`
   key derived by the naming rule. Adding one without the other fails CI.
3. Add the declaration block to the PR description with `declaration:` filled
   in and nothing else.
4. If you declared `new-feature`, say so in your handoff — plainly, e.g. "This
   adds a new user-facing feature, so it needs an access decision before it can
   merge." State that the decision is owed and stop there.
5. Do not fill in `audience`, `feature-key`, or `expiry`. Do not recommend a
   value for them in the PR body, in a comment, or in your handoff message.

If a human has already told you the audience for this specific feature, you may
record what they decided. Repeating an explicit instruction is not the same as
making the call.
