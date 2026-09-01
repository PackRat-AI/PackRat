# Feature gating

Every new feature ships with two controls, both off, both seeded into the
database by a migration. Turning a feature on is a database change you make when
you decide to, not a code change and not a release.

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

**3. A seed migration that creates both rows, off.**

```sql
-- packages/api/drizzle/00NN_seed_summit_log.sql
INSERT INTO "feature_flags" ("key", "enabled", "description") VALUES
	('enableSummitLog', false, 'Summit log')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "feature_access" ("key", "label", "description", "early_access_until") VALUES
	('summit-log', 'Summit Log', 'Summit log', NULL)
ON CONFLICT ("key") DO NOTHING;
```

Add a matching entry to `packages/api/drizzle/meta/_journal.json`.

`ON CONFLICT DO NOTHING` throughout: a row someone already created by hand is a
deliberate act, and a migration must never silently overwrite it. This also
makes re-running the migration harmless.

Set `early_access_until` to `NULL` unless you already know the feature is
Pro-first. A window can be added later in the database; it does not need to be
decided at merge.

## Why a migration

The deploy pipeline applies migrations per environment and stops if one fails.
That makes seeding atomic with the deploy: the controls exist before the code
that reads them is live, and a failure is loud rather than a row quietly missing
in production.

A post-merge job writing to the database would have given the same rows with
none of that — it can fail on a network blip or an expired credential, and
nobody notices until a feature behaves unexpectedly.

### The Drizzle Kit carve-out

`CLAUDE.md` has a hard rule: **never hand-write SQL migrations, always use
`drizzle-kit generate`.** Seed migrations are the documented exception, because
`drizzle-kit generate` diffs *schema* and will not emit data statements — there
is nothing for it to generate.

The exception is narrow and holds only when all of these are true:

- The migration contains **no schema changes** — no `CREATE`, `ALTER`, or `DROP`.
  A migration that both seeds and alters must be split in two.
- It touches only `feature_flags` and `feature_access`.
- Every statement is idempotent (`ON CONFLICT DO NOTHING`).
- The file name says what it is: `00NN_seed_*.sql`.

Because it changes no schema, no snapshot is generated for it and none is
needed — `migrate.ts` reads `_journal.json`, not the snapshots. Any migration
that does touch schema still goes through `drizzle-kit generate`, no exceptions.

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

`0051_seed_feature_controls.sql` backfilled all 12 flags that predate this
convention, with values mirroring the coded defaults, so applying it changed no
behaviour.

One key does not follow the derivation rule: the server-side gate at
`packages/api/src/routes/wildlife/index.ts:33` enforces access under the literal
`'wildlife'`, where the rule would give `wildlife-identification`. Both rows are
seeded. Leave it unless you are already changing that route.
