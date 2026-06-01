---
title: "Reliable local DB for Cloudflare Workers + Neon: use the local Neon HTTP proxy, not raw node-postgres in workerd"
date: 2026-06-01
category: docs/solutions/developer-experience/
module: "packages/api (local dev / e2e database)"
problem_type: developer_experience
component: development_workflow
severity: high
applies_when:
  - "Running wrangler dev / Playwright web-e2e locally against a Postgres DB"
  - "The API normally talks to Neon via @neondatabase/serverless in production"
  - "Local DB queries intermittently time out or drop under any real load"
symptoms:
  - "Postgres logs show: unexpected EOF on client connection with an open transaction"
  - "~50% of DB-backed requests fail with timeout exceeded when trying to connect (pg-pool)"
  - "Reliability looks fine sequentially but collapses under concurrent suite load"
root_cause: incomplete_setup
resolution_type: environment_setup
tags:
  - cloudflare-workers
  - neon
  - wrangler-dev
  - node-postgres
  - hyperdrive
  - local-neon-http-proxy
  - e2e
  - db-localtest-me
---

# Reliable local DB for Cloudflare Workers + Neon: use the local Neon HTTP proxy, not raw node-postgres in workerd

## Context

Standing up a local stack to run the web-e2e suite (wrangler dev API + a local Postgres) produced an unreliable database connection: roughly half of all DB-backed requests timed out under any real load. Sequential probes looked fine (e.g. 25/25), but the moment the app's stores synced concurrently or the Playwright suite ran sustained traffic, requests failed with 10s connection-acquire timeouts and Postgres logged `unexpected EOF on client connection`. Two reinvented workarounds — `maxUses: 1` on the pg pool, then a local Hyperdrive binding — never made it reliable.

The root issue: **the API connects to Postgres with `node-postgres` (`pg.Pool`) over a raw TCP socket, and the Cloudflare Workers local runtime (workerd/miniflare) silently drops pooled TCP sockets between requests.** The next request acquires a dead socket and waits out the full `connectionTimeoutMillis`. In production this never happens because the API talks to Neon via the `@neondatabase/serverless` HTTP/WebSocket driver (no long-lived TCP socket), and OSM/Hyperdrive front their connections.

The correct local setup already existed on a sibling branch (`feat/web-e2e-fix`) — it just wasn't on `development` yet, so it got reinvented instead of reused. See [[check-existing-infra-before-building]].

## Guidance

Run the **official local Neon HTTP proxy** so local Postgres speaks Neon's HTTP/WS wire format, and point `@neondatabase/serverless` at it. The app then uses the **exact same driver path as production** — no raw `pg.Pool` TCP sockets, so the workerd socket-drop problem cannot occur.

**1. Compose the proxy stack** (`packages/api/docker-compose.test.yml`): a Postgres container plus `ghcr.io/timowilhelm/local-neon-http-proxy` (HTTP `/sql` + WS `/v2` on port 4444) and `ghcr.io/neondatabase/wsproxy`.

```bash
NEON_PROXY_HOST_PORT=4444 POSTGRES_TEST_HOST_PORT=5457 \
  docker compose -p packrat-e2e -f packages/api/docker-compose.test.yml up -d
```

**2. Point `NEON_DATABASE_URL` at the proxy host** (`db.localtest.me` resolves to localhost via public wildcard DNS):

```
NEON_DATABASE_URL=postgres://test_user:test_password@db.localtest.me/packrat_test
```

**3. Route the driver to the local proxy** when the host is `db.localtest.me` (`packages/api/src/index.ts`):

```ts
function maybeConfigureLocalNeon(databaseUrl: string | undefined): void {
  if (neonLocalConfigured || !databaseUrl) return;
  if (new URL(databaseUrl).hostname.toLowerCase() !== 'db.localtest.me') return;
  neonConfig.fetchEndpoint = (h) =>
    h === 'db.localtest.me' ? `http://${h}:4444/sql` : `https://${h}/sql`;
  neonConfig.wsProxy = (h) => (h === 'db.localtest.me' ? `${h}:4444/v2` : `${h}/v2`);
  neonConfig.useSecureWebSocket = false;
}
```

**4. Exclude `db.localtest.me` from the raw-Postgres path** so it uses the neon driver, not `pg.Pool` (`packages/api/src/db/index.ts`):

```ts
const isLocalNeonProxy = host === 'db.localtest.me';
return (u.protocol === 'postgres:' || u.protocol === 'postgresql:')
  && !isNeonTech && !isNeonCom && !isLocalNeonProxy;
```

## Why This Matters

- **Reliability:** raw `node-postgres` in workerd was ~50% under load; through the proxy it was rock-solid — 20/20 sequential, 10/10 concurrent, zero timeouts. The web-e2e suite went from effectively unrunnable to 9/14 passing (the remaining 5 need real OpenAI keys / catalog data, validated in CI).
- **Fidelity:** local exercises the same `@neondatabase/serverless` code path as production, so local behavior actually predicts prod behavior.
- **Cost of the wrong path:** chasing pool tuning (`maxUses`, `keepAlive`) and a local Hyperdrive binding (which itself spins up a Docker proxy container and adds a flaky hop) burned significant time for no reliable result. The proxy is the supported answer (https://neon.com/guides/local-development-with-neon).

## When to Apply

- Any time you run `wrangler dev` or local e2e against Postgres for an API that uses `@neondatabase/serverless` in prod.
- Before writing custom pool-tuning or a Hyperdrive-local binding to "fix" local DB flakiness — reach for the proxy first.

## Examples

Before (raw pg in workerd — flaky):
```
NEON_DATABASE_URL=postgres://user:pass@localhost:5455/db   # pg.Pool → workerd drops sockets → ~50% timeouts
```

After (neon driver → local proxy — reliable):
```
NEON_DATABASE_URL=postgres://test_user:test_password@db.localtest.me/packrat_test   # neon HTTP/WS → proxy → Postgres
```

## Related

- `docs/solutions/integration-issues/web-auth-cross-origin-cors-credentials-secure-store-stub-2026-06-01.md` — the web-auth fixes this reliable local DB was built to validate.
- Process lesson: search sibling branches/worktrees for existing infra before reinventing it (this proxy setup already existed on `feat/web-e2e-fix`).
