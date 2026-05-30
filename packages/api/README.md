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

All four seeders use `drizzle-seed` as the tool surface (`.refine()` with
`f.default()` / `f.valuesFromArray()`). drizzle-seed has no native upsert,
so the three production-shape seeds gate their `seed()` call on an
explicit existence check — re-runs are safe in any environment.

| Command | Script | Purpose |
|---|---|---|
| `bun run db:seed` | `src/db/seed.ts` | Featured Pack templates (6 curated app templates, 164 items) |
| `bun run db:seed:e2e-user` | `src/db/seed-e2e-user.ts` | E2E test user (reads `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; refreshes password on re-run) |
| `bun run db:seed:oauth-clients` | `src/db/seed-claude-oauth-client.ts` | Pre-register Claude as an OAuth client (run once per env after deploy) |

One dev-only seed (drizzle-seed's randomized fake-data mode — for local
development + QA only):

| Command | Script | Purpose |
|---|---|---|
| `bun run db:seed:dev` | `src/db/seed-dev.ts` | Populate a fresh local DB with ~50 users, 150 packs, 1500 items, 100 catalog items, 80 posts, 200 comments — randomized via drizzle-seed's `f.fullName()` / `f.email()` / `f.loremIpsum()` |

`db:seed:dev` **TRUNCATEs the affected tables before inserting** (per
`drizzle-seed`'s default behavior). It **hard-refuses** to run against a
Neon-hosted URL — no override flag — so a stray prod run cannot wipe user
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

## AI Billing

AI-backed routes and services use Cloudflare AI Gateway when `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID`, and `CLOUDFLARE_API_TOKEN` are configured. Direct provider keys such as `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and `PERPLEXITY_API_KEY` are still required for fallback and rollback.

The root `.env.local` is copied into `packages/api/.dev.vars` by `bun install` / `bun run env`. See `../../docs/runbooks/ai-gateway-unified-billing.md` for the production setup and fallback runbook.
