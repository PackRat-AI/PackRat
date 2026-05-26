# @packrat/api

Elysia on Cloudflare Workers. Drizzle ORM against Neon Postgres.

## Develop

```sh
bun install
bun run dev               # wrangler dev -e=dev → http://localhost:8787
```

## Test

```sh
bun run test              # full suite (requires docker-compose postgres up)
bun run test:unit         # unit-only, no DB
```

## Database

```sh
bun run db:generate       # drizzle-kit generate (after editing schema)
bun run db:migrate        # apply pending migrations to NEON_DATABASE_URL
```

### Seeds

Three production-shape seeds (idempotent, plain `db.insert()` with existence
checks — re-runs are safe in any environment):

| Command | Script | Purpose |
|---|---|---|
| `bun run db:seed` | `src/db/seed.ts` | Featured Pack templates (6 curated app templates) |
| `bun run db:seed:e2e-user` | `src/db/seed-e2e-user.ts` | E2E test user (reads `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`) |
| `bun run db:seed:oauth-clients` | `src/db/seed-claude-oauth-client.ts` | Pre-register Claude as an OAuth client (run once per env after deploy) |

One dev-only seed (randomized fake data — for local development + QA only):

| Command | Script | Purpose |
|---|---|---|
| `bun run db:seed:dev` | `src/db/seed-dev.ts` | Populate a fresh local DB with ~50 users, 150 packs, 1500 items, 100 catalog items, 80 posts, 200 comments — realistic outdoor-domain content via `drizzle-seed` |

`db:seed:dev` **TRUNCATEs the affected tables before inserting** (per
`drizzle-seed`'s default behavior). It refuses to run against a Neon-hosted
URL unless `FORCE_SEED_DEV=1` is set, to prevent accidentally wiping prod
data. The seed RNG is fixed (`seed=42`) so re-runs produce the same content.

Typical onboarding flow against the docker-compose test DB:

```sh
cd packages/api
docker compose -f docker-compose.test.yml up -d                       # if not running
NEON_DATABASE_URL=postgres://test_user:test_password@localhost:5432/packrat_test \
  bun run db:migrate
NEON_DATABASE_URL=postgres://test_user:test_password@localhost:5432/packrat_test \
  bun run db:seed:dev
```

## Deploy

CI handles deploys via wrangler. Operator runbook lives at
[`docs/mcp/runbook.md`](../../docs/mcp/runbook.md) (covers env-var setup,
secret rotation, JWKS rotation, and the
`BETTER_AUTH_*` → `PACKRAT_*` migration steps).
