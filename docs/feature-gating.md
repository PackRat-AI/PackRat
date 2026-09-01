# Feature gating

Every new feature ships with two controls, both off, both seeded into the
database. Turning a feature on is a database change you make when you decide to,
not a code change and not a release.

## The two controls

| Control | Question | Table |
|---|---|---|
| Feature flag | Can this be on at all? | `feature_flags` |
| Feature access | Who may use it? | `feature_access` |

Both, always. They answer different questions and neither substitutes for the
other: a flag with no access row ships to whoever the flag lets in with nobody
having decided that, and an access row with no flag cannot be switched off if it
misbehaves.

`feature_flags` is a kill switch. `feature_access` is the monetization layer —
its single `early_access_until` timestamp means Pro-only until it passes, then
free for everyone, with no second flip to remember.

## The convention

Every new feature comes with three artifacts, in the same PR as the code:

**1. A flag in `packages/config/src/config.ts`, defaulting to `false`.**

```ts
const FeatureFlag = Object.freeze({
  // ...
  EnableSummitLog: 'enableSummitLog',
});

const APP_CONFIG_SOURCE = {
  featureFlags: {
    // ...
    [FeatureFlag.EnableSummitLog]: false,
  },
```

The default is the binary's answer when it cannot reach the database. `false`
means a feature that has shipped in a build but not yet been turned on stays
dark, which is what makes the rest of this safe.

**2. A `feature_access` key, named by the derivation rule.**

Drop the `enable` prefix, kebab-case the rest. A run of capitals is one word:

```
enableSummitLog               → summit-log
enableWildlifeIdentification  → wildlife-identification
enableLocalAI                 → local-ai
enableOAuth                   → oauth
```

`featureAccessKeyForFlag` in `packages/config/src/featureKeys.ts` is the single
implementation. Deriving the name rather than choosing one means you never have
to look up which access key belongs to which flag.

**3. An entry in the seed script, so both rows exist in the database.**

Add the flag's label and description to `FEATURE_CONTROLS` in
`packages/api/src/db/seed-feature-controls.ts`. The `enabled` default is read
from `packages/config` and the access key is derived, so neither is repeated
there — only the prose.

Then run it against each environment:

```bash
cd packages/api && bun run db:seed:feature-controls
```

Every insert is `ON CONFLICT DO NOTHING`, so re-running is harmless and will
never clobber a row an operator has since changed. It sits alongside the other
seeders (`db:seed:oauth-clients` and friends) as a post-deploy step.

`early_access_until` seeds as `NULL` — generally available. A Pro-first window
is something you set in the database when you decide on one; it is not seeded,
because early access is not a property of shipping the code.

## Why seeding is not a migration

Migrations own **schema**; this is **data**. Keeping the two apart means the
`drizzle-kit generate` rule in `CLAUDE.md` stays absolute with no exception to
remember, and re-seeding after adding a feature does not require inventing a new
migration file each time.

It also matches what the repo already does: `db:seed:oauth-clients` registers a
production config row the same way, and CI already runs it post-deploy.

The tradeoff is honest — a seed run is a separate step from the deploy, so it
can be forgotten. Nothing breaks when it is. A missing `feature_flags` row means
the client falls back to the coded default, which is `false` for anything new;
a missing `feature_access` row means the feature is generally available, but the
flag is still off. The feature stays dark either way. That is what makes the
looser coupling safe.

## Turning a feature on

Entirely a database operation, through the admin UI or SQL:

- **Enable the kill switch** — set `feature_flags.enabled = true`. The clients
  poll `/feature-flags`, so this takes effect without a release.
- **Make it Pro-first** — set `feature_access.early_access_until` to a future
  timestamp. It reverts to free for everyone automatically when that passes.
- **Ship it to everyone** — leave `early_access_until` as `NULL`.

Nothing here requires a deploy, which is the point of seeding the controls in
the first place.

## What CI does

Nothing. There is no gate, no required check, and no merge blocking.

An earlier version of this blocked merge until someone filled an audience into
the PR body. It was removed: the decision does not have to happen at merge time,
and forcing it there coupled shipping code to a product call that is better made
later, in the database, when you actually want the feature on.

The safety property does not depend on CI. It comes from the flag defaulting to
`false` in the binary and the seed row defaulting to off — a feature nobody has
touched is dark on every path.

## Existing keys

`seed-feature-controls.ts` covers all 12 flags that predate this convention,
with values mirroring the coded defaults, so the first run changed no observable
behaviour — it only moved the answer from "no row, fall back to the binary" to
"a row that says the same thing".

One key does not follow the derivation rule: the server-side gate at
`packages/api/src/routes/wildlife/index.ts:33` enforces access under the literal
`'wildlife'`, where the rule would give `wildlife-identification`. Both rows are
seeded. Leave it unless you are already changing that route.
