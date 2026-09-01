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

**Add one line to `packages/config/src/config.ts`. That is the whole
convention.** Everything else is derived from it.

**1. The flag, defaulting to `false`.**

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

**2. The `feature_access` key — derived, not chosen.**

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

**3. Nothing.**

That is the whole convention. The seed script derives everything from
`APP_CONFIG.featureFlags` — the flag key, its `enabled` default, the access key,
and a display label — so adding a feature needs no edit anywhere else:

```
enableSummitLog  →  feature_flags.key      = 'enableSummitLog'
                    feature_flags.enabled  = false     (the coded default)
                    feature_access.key     = 'summit-log'
                    feature_access.label   = 'Summit Log'
```

**CI seeds it automatically.** `.github/workflows/migrations.yml` runs the seed
right after migrations on every push to `main` or `development` touching
`packages/api/drizzle/**`, the seed script, or `packages/config/src/config.ts` —
so adding a flag is enough to get its rows created. To run it by hand:

```bash
cd packages/api && bun run db:seed:feature-controls
```

Every insert is `ON CONFLICT DO NOTHING`, so re-running is harmless and never
clobbers a row an operator has changed — including a nicer label typed into the
admin UI.

**A new feature seeds Pro-gated, not open.** `feature_access` has no "closed"
state of its own — the resolver reads a null or past `early_access_until` as
generally available — so a row seeded with `NULL` would be a row that is *open*.
New features therefore get a real early-access window
(`DEFAULT_EARLY_ACCESS_WEEKS`, six weeks) and are Pro-only until someone widens
them in the database.

The flag is still the real backstop: it defaults `false`, so a new feature is
dark regardless. The access default is the second layer — if someone turns the
flag on before thinking about audience, the feature reaches Pro members rather
than everyone.

Features that predate this convention are listed in `GENERALLY_AVAILABLE` in the
seed script and stay free for everyone: they already shipped, and applying a
window retroactively would take away access people have. That list is closed and
will not grow.

## Why seeding is not a migration

Migrations own **schema**; this is **data**. Keeping the two apart means the
`drizzle-kit generate` rule in `CLAUDE.md` stays absolute with no exception to
remember, and re-seeding after adding a feature does not require inventing a new
migration file each time.

It also matches what the repo already does: `db:seed:oauth-clients` registers a
production config row the same way, and CI already runs it post-deploy.

Being a script rather than a migration does mean seeding is a separate step —
which is why CI runs it automatically in the same workflow as migrations, rather
than leaving it to be remembered. If it is ever skipped, nothing breaks: a
missing `feature_flags` row falls back to the coded default, which is `false`
for anything new, so the feature stays dark.

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
