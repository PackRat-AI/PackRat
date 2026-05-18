---
title: "feat: client/server ID split — Phase 1 (DB shim + API)"
type: feat
status: active
created: 2026-05-17
origin: docs/design/client-uuid-split.md
---

# Phase 1: `client_uuid` shim + API accept-and-return

**Status:** active
**Plan depth:** Deep
**Scope:** PRs 1 + 2 from the [client-uuid-split design doc](../design/client-uuid-split.md) §9.
**Out of scope:** Mobile persisted-store migration (PR 3), mobile sync-wire switch (PR 4), legacy-`id`-shim drop (PR 5), Phase 2 bigint PK narrow (PR 6).

---

## 1. Problem frame

Today every offline-first table (`packs`, `pack_items`, `weight_history`, `pack_templates`, `pack_template_items`, `trips`, `trail_condition_reports`) has a single `id text` primary key with **dual ownership**: mobile mints client-side nanoid, T9 made it optional so MCP/CLI can omit it and the server mints `<prefix>_<12hex>` via `mintId()`. PR #2433 reverted T9 — the user called out that optional `id` "breaks core data integrity," because dual ownership of the PK leaves the server unable to enforce a format, can't dedupe retries idempotently, and forces every FK in the seven-table graph to hold a client-shaped string.

Phase 1 fixes the structural problem additively, without touching the PK type:

1. Add `client_uuid text UNIQUE NOT NULL` to each affected table (backfilled from current `id`).
2. Add a CHECK constraint forcing `^[A-Za-z0-9_-]{1,64}$`.
3. API accepts optional `clientUuid` on POST (alongside legacy `id`), upserts on `(client_uuid)` conflict for idempotency, returns `clientUuid` on every row.
4. `mintId(prefix)` survives as the lean-caller default — MCP/CLI/web don't have to mint anything; server fills `clientUuid` when omitted.

The result: retries are idempotent, the format is enforceable, mobile already has nanoids that map cleanly to `client_uuid`, and the PK type narrow (Phase 2) becomes a separate, reversible diff.

**Why this is safe to land alone:** Phase 1 is additive at every layer. The DB adds a column, the API adds a request/response field. Old clients sending `id` continue to work via a compat shim (see §5). Rollback is `DROP COLUMN client_uuid` per table.

---

## 2. Requirements traceability

Each requirement is sourced from the [origin design doc](../design/client-uuid-split.md). All R-IDs are Phase 1 only.

| ID  | Requirement                                                                                                                                                  | Source |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| R1  | Add `client_uuid text UNIQUE NOT NULL` column to seven affected tables, backfilled from `id`.                                                                | §2.2, §3 Option C |
| R2  | DB enforces `client_uuid` format via CHECK constraint matching `^[A-Za-z0-9_-]{1,64}$`.                                                                       | §2.3   |
| R3  | API POST endpoints accept optional `clientUuid` field, validated by the same regex at the Zod layer.                                                          | §5.1   |
| R4  | Handlers compute the value as `data.clientUuid ?? data.id ?? mintId(prefix)` (compat shim — Phase 1 only).                                                    | §5.4   |
| R5  | Handlers use `onConflictDoNothing(target: clientUuid)` + re-fetch to guarantee idempotent retries (same `clientUuid` → same row).                             | §5.3   |
| R6  | Every entity response schema (Pack, PackItem, PackWeightHistory, PackTemplate, PackTemplateItem, Trip, TrailConditionReport) returns `clientUuid` alongside `id`. | §5.2   |
| R7  | Phase 1 keeps `id` text-typed; `mintId` continues filling `id` for inserts when the caller doesn't supply one.                                                | §3 Phase 1 sketch |
| R8  | The API logs a deprecation warning (`deprecated_id_field`) when a request supplies `id` but not `clientUuid`, with userId + route, so we can measure cutover. | §5.4   |
| R9  | The migration is reversible at the DB layer (`DROP COLUMN client_uuid` per table) without any data loss.                                                      | §7 Phase 1 |
| R10 | MCP and CLI commands stop minting their own ids — they omit `clientUuid` from the request, letting the server fill it via `mintId`.                            | §8 Q4 (locked: server mints) |

---

## 3. Scope boundaries

### In scope (this plan)

- DB schema change: add `client_uuid` to seven tables with UNIQUE + format CHECK.
- Drizzle schema update in `packages/db/src/schema.ts`.
- Zod request schemas in `packages/schemas/src/{packs,packTemplates,trips,trailConditions}.ts` gain optional `clientUuid`.
- Zod response schemas gain `clientUuid` on the seven row shapes.
- Route handlers in `packages/api/src/routes/{packs,packTemplates,trips,trailConditions}/` accept the field, run the compat coalesce, do `onConflictDoNothing` upserts, return the new field.
- MCP/CLI consumers stop sending their own ids (the `shortId` helper from this session becomes dead code on the CLI side).
- Unit tests for idempotent retry behavior + the compat shim.

### Deferred to Follow-Up Work

- **PR 3 — Mobile persisted-store migration:** copy `id → clientUuid` in `apps/expo/lib/persist-plugin.ts`, re-key Legend State observables by `clientUuid`, add `packClientUuid`-style FK fields to the in-store types. Its own plan; depends on this landing first.
- **PR 4 — Mobile sync wire switch:** stores send `clientUuid` instead of `id`; `updatePack`/`updatePackItem` throw-and-retry on un-synced parents. Follows PR 3.
- **PR 5 — Drop the legacy `id`-on-create shim:** remove the `data.id ?? data.clientUuid` fallback in handlers once telemetry shows zero callers sending `id`-only. Waits on PR 4 reaching 100% of users + ~30 days of clean telemetry.

### Outside this product's identity

- **PR 6 — Phase 2 narrow `id` to `bigserial`:** separate design doc per §9 of origin. Big-bang FK rewrite, irreversible, requires maintenance window. Not even sequenced after this plan — needs its own brainstorm + plan.
- **Public-facing `slug` / `share_id`** for pack share URLs: orthogonal to this work. Origin §8 Q8.

---

## 4. Output structure

No new directories. All changes land in existing files:

- `packages/api/drizzle/0048_add_client_uuid.sql` (new migration file)
- `packages/db/src/schema.ts` (modify seven `pgTable` definitions)
- `packages/schemas/src/{packs,packTemplates,trips,trailConditions}.ts` (modify request + response schemas)
- `packages/api/src/routes/{packs,packTemplates,trips,trailConditions}/*.ts` (modify route handlers)
- `packages/api/src/utils/ids.ts` (re-introduce — was removed in T9 revert)
- `packages/mcp/src/tools/{packs,trips}.ts` (drop client-side id minting from create tools)
- `packages/cli/src/commands/{packs,trips,templates}/*.ts` (drop `shortId` calls from create commands)
- `packages/api/test/{packs,trips}.test.ts` (new + extended idempotency tests)

---

## 5. High-level technical design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Wire format change

```
POST /packs (Phase 1, additive)
─────────────────────────────────────
client request:
  { clientUuid?, name, ... }       ← new clients send clientUuid
  { id, name, ... }                ← old clients still work via shim

server (request handler):
  clientUuid = data.clientUuid ?? data.id ?? mintId('p')
  id         = mintId('p')          ← always server-minted from Phase 1 onward
                                     (was: data.id ?? mintId — T9 hack)
  insert ... onConflictDoNothing(target: clientUuid)
  if no row returned, SELECT by clientUuid (idempotent retry path)

server response:
  { id, clientUuid, name, ... }    ← every response gains clientUuid
```

### DB column lifecycle per table

```
Migration 0048:
  ADD COLUMN client_uuid text;
  UPDATE table SET client_uuid = id WHERE client_uuid IS NULL;
  ALTER COLUMN client_uuid SET NOT NULL;
  ADD CONSTRAINT <table>_client_uuid_unique UNIQUE (client_uuid);
  ADD CONSTRAINT <table>_client_uuid_format
    CHECK (client_uuid ~ '^[A-Za-z0-9_-]{1,64}$');
```

### Conflict-resolution path

```
INSERT INTO packs (id, client_uuid, ...) VALUES (...)
ON CONFLICT (client_uuid) DO NOTHING
RETURNING *;

if (returning.length === 0) {
  // existing row — idempotent retry
  return SELECT * FROM packs WHERE client_uuid = $clientUuid;
}
```

This is the recommended path (origin §5.3). `onConflictDoUpdate` was rejected in synthesis because it would refresh `localUpdatedAt` on every retry, polluting last-write-wins semantics for genuinely unchanged rows.

### Compatibility coalesce (Phase 1 only — removed in PR 5)

```
const clientUuid = data.clientUuid ?? data.id ?? mintId(prefix);

if (data.id && !data.clientUuid) {
  console.warn('deprecated_id_field', { userId: user.userId, route });
}
```

The `data.id` branch keeps mobile working unchanged on the wire until PR 4 ships. The warning log lets us see when callers stop using it.

---

## 6. Key technical decisions

### Decision 1: `onConflictDoNothing` + re-fetch (not `onConflictDoUpdate`)

Pure idempotency. A retry of `POST /packs` with the same `clientUuid` returns the existing row byte-for-byte, no side effects. `onConflictDoUpdate` would write `localUpdatedAt` on every duplicate request, which silently re-orders LWW reconciliation on the mobile side. The cost is one extra SELECT in the rare conflict path; the benefit is determinism.

(see origin: `docs/design/client-uuid-split.md` §5.3)

### Decision 2: Keep `mintId(prefix)` as the lean-caller default

The CLI's `shortId('p')` from earlier this session and the MCP tools' equivalent become dead code. Lean callers send nothing for `clientUuid`; server fills via `mintId`. This narrows the offline-first ID surface to just the mobile app — where it actually matters because Legend State needs a stable local key before the network round-trip.

(see origin: `docs/design/client-uuid-split.md` §8 Q4 — locked decision)

### Decision 3: CHECK constraint enforces `^[A-Za-z0-9_-]{1,64}$`

This is the URL-safe nanoid charset, plus our `mintId` format (`<prefix>_<12hex>` fits). The DB enforces it as a hard floor; the Zod schema applies the same regex at the API edge so format violations get a clean 422 with field-level context instead of a Postgres CHECK error. Tighter than today, where any string passes.

(see origin: `docs/design/client-uuid-split.md` §2.3)

### Decision 4: Re-introduce `packages/api/src/utils/ids.ts`

The `mintId(prefix)` helper file was deleted in the T9 revert (commit `67e6afea`). Phase 1 brings it back, but now its sole purpose is filling `clientUuid` (and, until Phase 2, `id`) on the server side when the caller didn't supply one. The semantics in the comment header should make clear it's a *server-side* helper, not a client-side ID-format contract.

### Decision 5: Deprecation log is `console.warn`, not metrics

Workers don't have a metrics primitive that survives a hot reload, and adding one for "count cutover progress" is over-engineering. `console.warn('deprecated_id_field', ...)` is grep-able in `wrangler tail` and Cloudflare Logpush — enough to answer "are any callers still sending `id`-only?" before pulling the PR 5 trigger.

---

## 7. System-wide impact

| Surface | Impact | Mitigation |
| --- | --- | --- |
| **DB (production)** | Adds one nullable column → backfills → makes NOT NULL → adds UNIQUE + CHECK constraints. Per-table downtime is the UNIQUE index build on existing rows. | Migration runs in a single transaction per table. UNIQUE index on `client_uuid` after backfill is fast (existing `id` values are already unique). Rollout uses Neon's standard apply path. Validate on staging first. |
| **API (Cloudflare Workers)** | Route handlers gain a coalesce + a different insert path (`onConflictDoNothing` + re-fetch). Eden Treaty types regenerate; downstream consumers see `clientUuid?` on POST bodies. | Additive: no breaking type changes for callers that don't opt in. Existing E2E tests should continue passing without modification. |
| **MCP (Cloudflare Workers)** | `add_pack`, `add_trip`, `add_pack_item` etc. tools drop the `id` parameter — server mints. | Tool schemas change; MCP clients (Claude Desktop, custom integrations) get the regenerated tool definitions automatically on next connection. No data-shape change in responses except the new `clientUuid` field. |
| **CLI (`@packrat/cli`)** | `packrat packs create`, `packrat trips create`, `packrat templates create` stop minting `shortId('p')` etc. Server fills `clientUuid`. The `shortId` function and the `uuid` dep can stay — they'll be needed when CLI adds an explicit `--client-uuid` flag for idempotent retry support in a follow-up. | The `shortId` function lives on for that future use. The `uuid` dep stays. |
| **Mobile (`apps/expo`)** | Zero changes in Phase 1. The compat shim (`data.id ?? data.clientUuid ?? mintId`) lets the mobile sync continue sending `id` for now. Deprecation warning fires on every mobile request, which is the signal that PR 3 needs to happen. | Watch the warning rate post-deploy. PR 3 plan can be written once Phase 1 is in production. |
| **Web (`apps/web`, `apps/admin`, `apps/landing`, `apps/guides`)** | None — these don't write to the seven affected tables in a way that hits the changed shape. Admin SPA reads only. | n/a |
| **OpenAPI / Eden Treaty types** | Response schemas regenerate to include `clientUuid: string` on every row shape. | Type bump only; no consumer is currently destructuring response shapes in a way that would break on additive fields. |

---

## 8. Implementation units

### U1. Drizzle schema update + migration 0048

**Goal:** Add `client_uuid` to seven tables in the Drizzle schema and generate the matching SQL migration. Backfill from existing `id`. Add UNIQUE and format CHECK.

**Requirements:** R1, R2, R9

**Dependencies:** none — starting point.

**Files:**
- Modify: `packages/db/src/schema.ts` (seven `pgTable` definitions: `packs` L110, `packItems` L225, `packWeightHistory` L261, `packTemplates` L274, `packTemplateItems` L296, `trailConditionReports` L322, `trips` L358)
- Create: `packages/api/drizzle/0048_add_client_uuid.sql`
- Test (via `bun test:api:unit`): `packages/api/test/migrations.test.ts` if it exists; otherwise spot-checked manually

**Approach:**
- For each table, add `clientUuid: text('client_uuid').unique().notNull()` to the column definitions.
- Run `bun drizzle-kit generate` to produce the migration SQL.
- Manually edit the generated SQL to add the backfill `UPDATE table SET client_uuid = id` between the `ADD COLUMN` and `SET NOT NULL` steps (Drizzle won't generate this automatically).
- Add the format CHECK constraint as a raw SQL `ALTER TABLE ... ADD CONSTRAINT ...` block at the end of the migration.
- Verify the migration is reversible by writing a sibling `0048_add_client_uuid_DOWN.sql` (or document the rollback as `DROP COLUMN client_uuid` per table in this plan).
- Pattern reference: existing `packages/api/drizzle/0040_uuid_pk_better_auth_migration.sql` for migration style (raw SQL with comments, explicit constraint names).

**Test scenarios:**
- Test expectation: none — pure migration. Verification happens on staging Neon DB before production.

**Verification:**
- `bun drizzle-kit generate` produces no further diff after the migration is written (schema matches migration output).
- Applying 0048 to a fresh DB seeded with existing data: all rows get `client_uuid = id`; no rows fail the UNIQUE or CHECK constraints (because existing `id` values are already unique and already match the charset).
- The seven tables show `client_uuid` as `not null` + `unique` + `check` in `\d table_name` on staging.

---

### U2. Re-introduce `mintId` helper

**Goal:** Re-add `packages/api/src/utils/ids.ts` with the `mintId(prefix)` helper. Header comment makes clear it's server-side, fills `clientUuid` (and `id` until Phase 2).

**Requirements:** R4, R7

**Dependencies:** U1 (so the column it's filling exists in the schema types).

**Files:**
- Create: `packages/api/src/utils/ids.ts`
- Test: covered indirectly via U3-U6 idempotency tests.

**Approach:**
- One exported function: `export function mintId(prefix: string): string`.
- Format: `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}` — matches the format that's in production right now via every existing row.
- Header comment: explain this is a server-side default for `clientUuid` when the caller doesn't supply one. Distinct from any client-side ID generation.

**Test scenarios:**
- Test expectation: none — single pure function, covered by integration tests in U3.

**Verification:**
- `bun check-types` passes after the file is added.
- Routes that import `mintId` (added in U3-U6) compile.

---

### U3. API: `/packs` and `/packs/:packId/items` accept + return `clientUuid`

**Goal:** Update Zod schemas + handlers for the pack and pack-item endpoints to accept optional `clientUuid`, run the compat coalesce, do `onConflictDoNothing` upserts, return the new field. Includes the weight-history endpoint.

**Requirements:** R3, R4, R5, R6, R8

**Dependencies:** U1 (schema), U2 (mintId).

**Files:**
- Modify: `packages/schemas/src/packs.ts` (add `clientUuid` to `CreatePackBodySchema`, `AddPackItemBodySchema`, `CreatePackWeightHistoryBodySchema`, `PackSchema`, `PackItemSchema`, `PackWeightHistoryResponseSchema`)
- Modify: `packages/api/src/routes/packs/index.ts` (handlers for `POST /`, `POST /:packId/items`, `POST /:packId/weight-history`)
- Test: `packages/api/test/packs.test.ts` (extend existing; add idempotency tests)

**Approach:**
- Zod: `clientUuid: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional()` on request schemas. `clientUuid: z.string()` on response schemas.
- Handler pattern (pseudocode, directional):
  ```
  const clientUuid = data.clientUuid ?? data.id ?? mintId('p');
  if (data.id && !data.clientUuid) {
    console.warn('deprecated_id_field', { userId, route: 'POST /packs' });
  }
  const [newRow] = await db.insert(packs).values({ ...
    id: mintId('p'),  // server-owned from here forward
    clientUuid,
    ...
  }).onConflictDoNothing({ target: packs.clientUuid }).returning();
  if (!newRow) {
    return await db.query.packs.findFirst({
      where: and(eq(packs.clientUuid, clientUuid), eq(packs.userId, user.userId))
    });
  }
  ```
- The `userId` scope on the re-fetch is important: it prevents a malicious client from probing the `clientUuid` namespace of other users (the UNIQUE constraint is global, but a user should only ever see their own rows).
- Response always includes `clientUuid` — populate from the inserted/fetched row.

**Patterns to follow:**
- The pre-existing `pgCode === '23505'` re-fetch pattern in `packages/api/src/routes/trailConditions/reports.ts` POST handler — same structural shape, but `onConflictDoNothing` is cleaner than catching the unique-violation error.

**Test scenarios:**
- **Happy path — new pack with `clientUuid`:** `POST /packs` with `{ clientUuid: 'p_abc...', name: 'Test' }`. Expect 200 with response `{ id, clientUuid: 'p_abc...', name: 'Test', ... }`. Verify DB row has `client_uuid = 'p_abc...'`.
- **Happy path — new pack without `clientUuid` (lean caller):** `POST /packs` with `{ name: 'Test' }`. Expect 200 with response containing a server-minted `clientUuid` matching `/^p_[a-f0-9]{12}$/`.
- **Compat path — old client sending `id`:** `POST /packs` with `{ id: 'p_legacy123', name: 'Test' }`. Expect 200 with response `{ id, clientUuid: 'p_legacy123', ... }`. Verify a deprecation warning fired (spy on `console.warn`).
- **Idempotency — same `clientUuid` twice:** Send `POST /packs` with `{ clientUuid: 'p_abc', name: 'Original' }`, then resend with `{ clientUuid: 'p_abc', name: 'Different' }`. Second call returns the *original* row (name still 'Original'). DB has exactly one row with `client_uuid = 'p_abc'`.
- **Cross-user isolation:** User A creates pack with `clientUuid: 'shared_uuid'`. User B's `POST /packs` with the same `clientUuid` succeeds (different `userId`) — verify two distinct rows exist with the same `client_uuid` only if the UNIQUE constraint is per-user-scoped. **Decision required during implementation:** the current design has `client_uuid UNIQUE` globally; if cross-user collision is a real concern, the UNIQUE becomes `(user_id, client_uuid)`. The design doc §2.2 says global UNIQUE; flag in PR review if telemetry suggests otherwise.
- **Format violation — invalid `clientUuid`:** `POST /packs` with `{ clientUuid: 'has spaces!', name: 'Test' }`. Expect 422 with field-level Zod error before hitting the DB.
- **Format violation — too long:** `POST /packs` with a 65-char `clientUuid`. Expect 422.
- **Edge — empty `clientUuid` string:** `POST /packs` with `{ clientUuid: '', name: 'Test' }`. Should be rejected at Zod (`.regex` doesn't match empty); expect 422.

**Verification:**
- All test scenarios pass via `bun test:api:unit`.
- `bun check-types` clean.
- Manual smoke: `curl` against local dev API; confirm `clientUuid` round-trips and idempotency holds.

---

### U4. API: `/trips` and `/pack-templates` accept + return `clientUuid`

**Goal:** Same shape as U3, applied to the trip + pack-template + pack-template-item endpoints.

**Requirements:** R3, R4, R5, R6, R8

**Dependencies:** U1 (schema), U2 (mintId), U3 (sets the handler pattern).

**Files:**
- Modify: `packages/schemas/src/trips.ts` (add `clientUuid` to `CreateTripBodySchema`, `TripSchema`)
- Modify: `packages/schemas/src/packTemplates.ts` (add to `CreatePackTemplateRequestSchema`, `CreatePackTemplateItemRequestSchema`, and their response counterparts)
- Modify: `packages/api/src/routes/trips/index.ts` (POST `/` handler)
- Modify: `packages/api/src/routes/packTemplates/index.ts` (POST `/`, POST `/:templateId/items` handlers)
- Test: `packages/api/test/trips.test.ts`, `packages/api/test/packTemplates.test.ts` (extend or create)

**Approach:** Mirror U3's pattern. Use prefix `t_` for trips, `pt_` for templates, `pti_` for template items.

**Test scenarios:**
- For each of the three POST endpoints (`/trips`, `/pack-templates`, `/pack-templates/:templateId/items`), repeat the four core scenarios from U3:
  - Happy path with explicit `clientUuid`.
  - Happy path without `clientUuid` (server mints).
  - Compat path with legacy `id` (deprecation warning fires).
  - Idempotent retry with the same `clientUuid`.
- Trip-specific edge — `packId` FK is currently `text → packs.id`. Verify creating a trip with a `clientUuid` and a `packId` referencing an existing pack still works (the FK column doesn't change in Phase 1).

**Verification:**
- All trip + template tests pass.
- `bun check-types` clean.

---

### U5. API: `/trail-conditions/reports` accept + return `clientUuid`

**Goal:** Same shape as U3-U4, applied to the trail-condition-reports POST endpoint.

**Requirements:** R3, R4, R5, R6, R8

**Dependencies:** U1, U2, U3.

**Files:**
- Modify: `packages/schemas/src/trailConditions.ts`
- Modify: `packages/api/src/routes/trailConditions/reports.ts` (POST handler — note it currently has a `pgCode === '23505'` re-fetch path that should be *replaced* with `onConflictDoNothing` for consistency with U3)
- Test: `packages/api/test/trailConditions.test.ts` (create if doesn't exist)

**Approach:** Mirror U3. Use prefix `tcr_`. Replace the existing 23505-catch idempotency with `onConflictDoNothing` for parity with the other endpoints.

**Test scenarios:** Same four-scenario template as U3-U4, applied to `POST /trail-conditions/reports`.

**Verification:** Tests pass; check-types clean.

---

### U6. MCP tools drop client-side ID minting

**Goal:** Remove `id`-supplying behavior from the MCP create tools. Tools no longer accept `id` as input; the body sent to the API omits `clientUuid`; server mints.

**Requirements:** R10

**Dependencies:** U3, U4, U5 (so server-mint path works).

**Files:**
- Modify: `packages/mcp/src/tools/packs.ts` (`add_pack`, `add_pack_item`)
- Modify: `packages/mcp/src/tools/trips.ts` (`add_trip` if it exists)
- Modify: `packages/mcp/src/tools/packTemplates.ts` (`create_pack_template`, `add_pack_template_item`)
- Test: `packages/mcp/test/*.test.ts` (smoke — verify tool definitions don't accept `id`)

**Approach:**
- Remove `id` from each tool's `inputSchema`.
- Remove `id` from the body sent in the `agent.api.user.packs.post({...})` call.
- Keep all other fields unchanged.

**Test scenarios:**
- **Tool registration:** Confirm `add_pack` tool's input schema doesn't include `id` (the design's "server mints" intent is enforced at the schema level).
- **Tool invocation:** Calling `add_pack` with `{ name: 'X', ... }` returns a pack with server-minted `id` and `clientUuid`.
- Test expectation per tool: one happy-path test confirming the field is gone from the schema and the response shape has `clientUuid`.

**Verification:** MCP test suite passes (`bun test:mcp`). Manual: invoke `add_pack` via the MCP dev harness, confirm the schema in `tools/list` lacks `id`.

---

### U7. CLI commands drop client-side ID minting

**Goal:** Remove `id: shortId('p')` etc. from the CLI create commands. Server mints via the omitted `clientUuid`.

**Requirements:** R10

**Dependencies:** U3, U4, U6 (the API + MCP changes set the pattern).

**Files:**
- Modify: `packages/cli/src/commands/packs/create.ts` (drop `id: shortId('p')`)
- Modify: `packages/cli/src/commands/trips/index.ts` (drop `id: shortId('t')`)
- Modify: `packages/cli/src/commands/templates/index.ts` (drop `id: shortId('pt')`)
- Keep: `packages/cli/src/api/ids.ts` — `shortId` function and `uuid` dep stay, for future use (e.g., explicit `--client-uuid` flag for retry idempotency from the shell).

**Approach:**
- Remove the `id:` field from each `.post({...})` body.
- Leave the `shortId` import in place if it's used elsewhere; if not, remove the unused import.

**Test scenarios:**
- Test expectation: none — CLI doesn't currently have unit tests for these commands. Manual smoke: `packrat packs create "My Pack"` succeeds and the printed response shows a server-minted `id`.

**Verification:**
- `bun check-types` passes (no broken imports).
- Manual: run `packrat packs create "Test"` against local dev API, confirm a pack is created and the response includes both `id` and `clientUuid`.

---

### U8. Documentation: design doc status + plan handoff notes

**Goal:** Update the design doc to note Phase 1 PR 1+2 is shipping under this plan; note follow-up plans for PR 3, 4, 5; cross-link.

**Requirements:** none (housekeeping).

**Dependencies:** U1-U7 (so the doc reflects what actually landed).

**Files:**
- Modify: `docs/design/client-uuid-split.md` (add a "Status" banner at top + per-PR status notes in §9)

**Approach:**
- Top of doc: change `Status: Draft — for review, no code yet.` to `Status: Phase 1 PR 1+2 in progress (see [plan](../plans/2026-05-17-001-feat-client-uuid-split-phase1-plan.md)).`
- §9 PR 1 and PR 2: append `[shipping in plan 2026-05-17-001]`.
- §9 PR 3-5: note these are deferred to follow-up plans.

**Test scenarios:** none.

**Verification:** Markdown renders without broken links.

---

## 9. Phased delivery

This plan delivers two atomic PRs in sequence:

### PR A — DB + helper (U1, U2)

- Drizzle schema update.
- Migration 0048.
- `mintId` helper re-introduced.
- No route changes yet.

**Mergeable signal:** Migration applies cleanly on staging; UNIQUE + CHECK constraints hold on existing data; Drizzle schema generates without further diff.

### PR B — API + clients (U3, U4, U5, U6, U7, U8)

- All Zod request + response schemas updated.
- All POST handlers updated.
- MCP tools updated.
- CLI commands updated.
- Design doc updated.

**Mergeable signal:** All API tests pass (especially idempotency tests); `bun check-types` clean; manual smoke against local dev shows `clientUuid` round-trips and retries are idempotent.

PR B depends on PR A landing (the column has to exist before the routes can write to it). Squash-merge both, keeping the design doc's PR numbering (PR 1 and PR 2 from §9).

---

## 10. Risk analysis & mitigation

| Risk | Likelihood | Severity | Mitigation |
| --- | --- | --- | --- |
| Backfill `UPDATE clients_uuid = id` fails because some existing `id` values exceed 64 chars or contain disallowed chars. | Low | Medium — blocks migration | Spot-check production data length distribution + charset before merging PR A. Existing IDs are either `<prefix>_<12hex>` (16 chars) or 21-char nanoid (both URL-safe). Should be clean, but verify. |
| `onConflictDoNothing` semantics differ between drizzle-orm versions. | Low | Medium | We're on `drizzle-orm: ^0.45.2` (verified in package.json catalog). The conflict syntax is stable since 0.30. Pin the version via the catalog if needed. |
| Compat shim creates a race: client A sends `id: foo`, client B sends `clientUuid: foo` — second one hits a UNIQUE violation when it shouldn't. | Low | Low — manifests as a retryable 5xx | The CHECK constraint catches malformed values at insert time; the UNIQUE constraint correctly rejects duplicates. The "shouldn't" framing is wrong — two callers using the same UUID is genuinely a duplicate, and idempotent return-existing is the right behavior. |
| `console.warn('deprecated_id_field')` floods Cloudflare logs once mobile starts hitting it. | Medium | Low | Set up a Logpush filter to sample 1-in-100 of these. Or use `console.info` to keep it out of the warning tier. |
| Re-fetch after `onConflictDoNothing` is missing the user-scoped check, allowing a malicious client to probe other users' `clientUuid` namespace via timing. | Medium | High — privacy/IDOR | The re-fetch query MUST include `eq(packs.userId, user.userId)`. Code review must verify this on every endpoint. The test scenario "Cross-user isolation" in U3 covers it. |
| Mobile keeps sending `id` indefinitely because PR 3 (mobile store rewrite) gets deprioritized. | Medium | Low — Phase 2 stays blocked | This is fine. Phase 1 doesn't depend on mobile updating. The deprecation warning rate just stays high until PR 3 ships. Phase 2 only unblocks once mobile has cut over. |
| Drizzle migration generator produces wrong SQL for the column-add + backfill + NOT-NULL sequence. | Medium | Medium | The generator definitely won't produce the `UPDATE` between `ADD COLUMN` and `SET NOT NULL` — that has to be added manually. Always inspect the generated SQL; don't blindly trust `drizzle-kit generate`. |

---

## 11. Open questions deferred to implementation

These come up only once the code is being written, not before:

- **Drizzle CHECK constraint syntax:** drizzle-orm `0.45.2` may or may not expose `pgTable`'s `check()` builder cleanly. If the generator emits `ALTER TABLE` for the CHECK separately from the column, we hand-write the SQL. Decide on inspection of the generated 0048.
- **Test fixture updates:** `packages/api/test/fixtures/{pack,trip}-fixtures.ts` likely supply `id` directly. They'll need to either omit `id` (let server mint) or supply `clientUuid` instead. Inspect when wiring U3.
- **Eden Treaty type regeneration:** does the OpenAPI generator pick up the new optional `clientUuid` automatically, or does something need to be re-run? Confirm on the first API change.
- **TrailConditionReports — does it have an existing test suite?** §6 of design doc says §5 is shipping in next release cycle. Confirm test infra exists before extending in U5.

---

## 12. Success criteria

- All API tests pass, including five idempotency scenarios per affected endpoint (U3-U5).
- Migration 0048 applies cleanly on staging; no existing rows fail UNIQUE or CHECK.
- `bun check-types` passes across the monorepo.
- Eden Treaty regenerates with `clientUuid` on every affected response shape.
- Manual smoke: `curl POST /packs` with the same `clientUuid` twice returns the same row both times.
- Deprecation warning fires exactly once per `id`-only request (verify in logs after deploy).
- MCP tool definitions no longer accept `id` for `add_pack`, `add_trip`, `create_pack_template`, `add_pack_template_item`.
- CLI commands `packrat packs create`, `packrat trips create`, `packrat templates create` succeed without supplying `id` to the body.

Once Phase 1 is live for ~30 days with the deprecation rate trending to zero from mobile sources, PR 5 (drop the compat shim) can be planned. Phase 2 (`bigserial` narrow) starts as a separate design doc.
