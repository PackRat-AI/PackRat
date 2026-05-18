# Design: Client/Server ID split for offline-first tables

**Status:** Phase 1 PR 1 + 2 in progress — see [plan](../plans/2026-05-17-001-feat-client-uuid-split-phase1-plan.md).
**Author:** Architecture follow-up to [PR #2433](https://github.com/PackRat-AI/PackRat/pull/2433) ("T9: server-side ID minting").
**Scope:** `packs`, `pack_items`, `weight_history`, `trips`, `pack_templates`, `pack_template_items`, `trail_condition_reports`.

---

## 1. Background & motivation

### What T9 did

PR #2433 made every offline-syncable `POST` accept an **optional** `id` and mint one server-side via `mintId(prefix)` (`packages/api/src/utils/ids.ts`) when absent:

```ts
// packages/api/src/utils/ids.ts (post-T9)
export function mintId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}
```

```ts
// packages/api/src/routes/packs/index.ts (post-T9)
const packId = data.id ?? mintId('p');
```

This unlocked lean callers (`@packrat/mcp`, `@packrat/cli`, web) that have no offline-first concerns and shouldn't have to mint their own IDs. Offline-first stores (`apps/expo/features/*/store/*.ts`) keep supplying `nanoid()`-generated IDs because Legend State writes to the local store *before* the network round-trip — the row needs a stable key to live under in `observable<Record<string, T>>` and to be referenced by FK-bearing rows (`packItems.packId`, `trips.packId`).

### What's hacky about it

One column (`packs.id`, `pack_items.id`, etc.) has **dual ownership**:

- Sometimes the **client** owns it (offline-first mobile). The server is required to accept and persist whatever the client sent, with `notNull()` and `primaryKey()` enforcing only that *something* is there.
- Sometimes the **server** owns it (MCP / CLI / web with no offline concerns), and mints it lazily.

Consequences:

1. **No invariant on format.** Today every server-minted ID is `<prefix>_<12-hex>`, but client-supplied IDs are raw `nanoid()` (21 chars, URL-safe). The DB can't tell them apart, and a stray `pack.id = 'banana'` from a misbehaving client would be accepted.
2. **No idempotency primitive.** Retrying a `POST /packs` after a network blip produces a duplicate row (with a new server-minted id) unless the client also remembers and resends `id`. The contract for that is implicit.
3. **The PK does double duty.** It's both the storage key *and* the dedup key, which means we can't safely change PK shape (e.g. switch to numeric serial for index locality) without re-coordinating the offline-first contract.
4. **Foreign keys reference a client-owned string.** `pack_items.pack_id` points at `packs.id`. If we ever wanted to switch the server PK to something cheaper to index (bigserial or UUIDv7), we'd have to migrate every FK column simultaneously, because the client is part of the contract.
5. **`createdAt` / `updatedAt` confusion.** We already split server-controlled timestamps (`created_at`, `updated_at`) from client-controlled ones (`local_created_at`, `local_updated_at`). The id column is the last holdout where the split hasn't been applied.

### The cleaner pattern

Two columns, two owners:

| Column       | Owner  | Purpose                                                                        |
| ------------ | ------ | ------------------------------------------------------------------------------ |
| `id`         | server | Real primary key. Server-minted at insert. Used by all server-side joins/FKs.  |
| `client_uuid` | client | Stable idempotency key supplied at create time. `UNIQUE NOT NULL`. Used by sync. |

Local writes land in the Legend State store keyed by `clientUuid`. On first successful sync, the client receives `{ id, clientUuid }` and learns the server id. Subsequent writes (PATCH/DELETE) address the row by `id`. FK columns (`pack_items.pack_id`) hold the server `id` once the parent has synced — the local store maintains a `clientUuid → id` map for any FK edges that need rewriting in the offline window (see [§6](#6-foreign-keys-in-the-offline-window)).

This is the standard "offline-first replicated database" pattern (Linear, Figma, Notion, Replicache all do a variant). It separates **identity** (server) from **idempotency** (client), and it lets us evolve the PK shape independently of the offline-first contract.

---

## 2. Target schema

### 2.1 Decision: numeric `bigserial` vs `UUIDv7`

I recommend **`bigserial`** (alias for `bigint` + sequence) for the new server-owned `id`, not UUIDv7. Reasoning:

| Criterion             | bigserial                                               | UUIDv7                                               |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Index locality        | Excellent — monotonic, btree-friendly                    | Good (time-ordered) but 2x byte width                |
| Storage               | 8 bytes                                                 | 16 bytes (or 36 as text — what we'd actually use)    |
| FK column width       | 8 bytes per row × every FK = significant                | 16+ bytes, plus join cost                            |
| External exposure     | Leaks growth rate                                       | Opaque                                               |
| Already used in codebase | Yes: `catalog_items.id`, `posts.id`, `post_likes.id`, `etc` | No                                                |
| Mintable without round-trip | No (need server)                                  | Yes (but we don't need to — `client_uuid` covers that) |

The "mintable without round-trip" argument for UUIDv7 doesn't apply here because **`client_uuid` is what the offline-first client uses for that purpose**. The server `id` only needs to exist once the row reaches the server, and at that point we already have a sequence. Width matters: `pack_items` is the highest-fanout table and currently has `pack_id text` — switching to `bigint` saves real bytes per row.

`users.id` stays `text`/UUID for Better Auth compatibility — that's an external contract we don't control. Tables with FKs to `users.id` keep `user_id text`. This design only touches the seven offline-first tables.

> **If we later want opaque external IDs** (for share URLs etc.) we can add a separate `public_id text UNIQUE` column with a UUIDv7 default. That's orthogonal to this design.

### 2.2 Per-table target shape

For each affected table the diff is: rename the existing `id text` to `client_uuid text UNIQUE NOT NULL`, add a new `id bigserial PRIMARY KEY`, and convert FK columns to `bigint`.

#### `packs`

```ts
export const packs = pgTable(
  'packs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clientUuid: text('client_uuid').unique().notNull(),
    name: text('name').notNull(),
    // ... unchanged columns ...
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    templateId: bigint('template_id', { mode: 'number' }).references(() => packTemplates.id),
    // ... unchanged columns ...
  },
  (t) => [
    index('packs_user_id_idx').on(t.userId),
    index('packs_client_uuid_idx').on(t.clientUuid), // already implied by UNIQUE
  ],
);
```

#### `pack_items`

```ts
export const packItems = pgTable(
  'pack_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clientUuid: text('client_uuid').unique().notNull(),
    // ... unchanged columns ...
    packId: bigint('pack_id', { mode: 'number' })
      .references(() => packs.id, { onDelete: 'cascade' })
      .notNull(),
    catalogItemId: integer('catalog_item_id').references(() => catalogItems.id),
    userId: text('user_id').references(() => users.id).notNull(),
    templateItemId: bigint('template_item_id', { mode: 'number' }).references(() => packTemplateItems.id),
    // ... unchanged columns ...
  },
  // ... unchanged indexes ...
);
```

#### `weight_history`, `pack_templates`, `pack_template_items`, `trips`, `trail_condition_reports`

Same shape: `id bigserial PK`, `client_uuid text UNIQUE NOT NULL`, FK columns to other offline-first tables become `bigint`.

FK rewrites:

| Table                       | FK column       | Was             | Becomes                              |
| --------------------------- | --------------- | --------------- | ------------------------------------ |
| `pack_items`                | `pack_id`       | `text`          | `bigint → packs.id`                  |
| `pack_items`                | `template_item_id` | `text`        | `bigint → pack_template_items.id`    |
| `weight_history`            | `pack_id`       | `text`          | `bigint → packs.id`                  |
| `pack_template_items`       | `pack_template_id` | `text`        | `bigint → pack_templates.id`         |
| `packs`                     | `template_id`   | `text`          | `bigint → pack_templates.id`         |
| `trips`                     | `pack_id`       | `text`          | `bigint → packs.id`                  |
| `trail_condition_reports`   | `trip_id`       | `text`          | `bigint → trips.id`                  |

`user_id text` columns are unchanged everywhere.

### 2.3 Format constraints on `client_uuid`

Server should validate `client_uuid` is non-empty, ≤ 64 chars, and matches `^[A-Za-z0-9_-]+$` (URL-safe, nanoid-compatible). The Zod schema enforces this at the API edge; a CHECK constraint enforces it at the DB:

```sql
ALTER TABLE packs
  ADD CONSTRAINT packs_client_uuid_format
  CHECK (client_uuid ~ '^[A-Za-z0-9_-]{1,64}$');
```

This is opportunistically tighter than today, where any string passes.

---

## 3. Migration path for existing rows

Every existing row has `id` like `p_a1b2c3d4e5f6` (T9 server-minted) or a 21-char nanoid (client-supplied). Three options:

### Option A — Move existing id to `client_uuid`, mint fresh server ids

```sql
ALTER TABLE packs ADD COLUMN client_uuid TEXT;
UPDATE packs SET client_uuid = id;
ALTER TABLE packs ALTER COLUMN client_uuid SET NOT NULL;
ALTER TABLE packs ADD CONSTRAINT packs_client_uuid_unique UNIQUE (client_uuid);

ALTER TABLE packs ADD COLUMN new_id BIGSERIAL;
-- (sequence auto-fills new_id for existing rows)
-- ... drop FK constraints from pack_items, weight_history, trips ...
-- ... add new FK columns, populate via JOIN on client_uuid, swap, drop old ...
ALTER TABLE packs DROP COLUMN id;
ALTER TABLE packs RENAME COLUMN new_id TO id;
ALTER TABLE packs ADD PRIMARY KEY (id);
```

**Pros:** End state is clean. `client_uuid` for every row is the value the mobile store already has locally — no client-side data migration. Server ids are real bigints.

**Cons:** Big bang. Hairy: every FK in the seven-table graph must be rewritten in the same transaction, in dependency order, with `ON DELETE CASCADE` re-installed. Hard to roll back. Old REST clients with cached deep links (`/packs/p_a1b2c3d4`) 404 unless we also keep a legacy lookup path.

### Option B — Compatibility shim: keep id text, add client_uuid alongside

Don't change the PK type. Just add `client_uuid text UNIQUE NOT NULL` and backfill it from `id`. Server keeps generating `text` ids (via `mintId` or sequence-backed), clients keep supplying their `nanoid` in `client_uuid`. Over time, the *meaning* of `id` shifts to "server-owned" without changing its *type*.

**Pros:** No FK rewrites. Reversible by dropping the column. Mobile store keeps working: it can switch its local key from `id` to `client_uuid` independently. URLs and external references keep working.

**Cons:** Doesn't actually fix the structural problem we set out to fix — `id` is still text, still wide as a FK, still externally exposed. We'd be paying migration cost for half the benefit. Also: requires a follow-up to *really* split, so we'd end up doing Option A later anyway, just on a smaller surface.

### Option C — Hybrid: shim now, narrow later

Phase 1: Option B (add `client_uuid`, leave `id` text).
Phase 2: After mobile fully migrates to addressing rows by `client_uuid` locally and by server `id` for FKs, run Option A on the now-empty contract.

**Pros:** Each phase is reversible. Mobile rollout decoupled from DB rollout.
**Cons:** Two migrations, two windows of compatibility code, twice the review.

### Recommendation: **Option C (hybrid)**

Andrew's instinct on PR #2433 was right that this needs its own brainstorm, but it doesn't all need to land at once. Phase 1 (shim) is small, reversible, and immediately unlocks idempotent retries — the biggest user-visible bug class today. Phase 2 (narrow PK to `bigint`) is bigger but can wait until mobile has shipped the addressing-by-`client_uuid` rewrite and we have ~30 days of telemetry showing no stragglers.

**Phase 1 migration sketch:**

```sql
-- packages/api/drizzle/0048_add_client_uuid.sql
ALTER TABLE "packs" ADD COLUMN "client_uuid" text;
UPDATE "packs" SET "client_uuid" = "id" WHERE "client_uuid" IS NULL;
ALTER TABLE "packs" ALTER COLUMN "client_uuid" SET NOT NULL;
ALTER TABLE "packs" ADD CONSTRAINT "packs_client_uuid_unique" UNIQUE ("client_uuid");
ALTER TABLE "packs" ADD CONSTRAINT "packs_client_uuid_format"
  CHECK ("client_uuid" ~ '^[A-Za-z0-9_-]{1,64}$');

-- Repeat for: pack_items, weight_history, pack_templates, pack_template_items,
--             trips, trail_condition_reports
```

That's it for phase 1 on the DB side. No FK changes, no PK changes. Reversal is `ALTER TABLE ... DROP COLUMN client_uuid` per table.

**Phase 2 migration sketch (later PR, after mobile rollout):**

```sql
-- packages/api/drizzle/00XX_narrow_id_to_bigserial.sql
-- For each table, in topological order from leaves to roots:
--   1. Add new_id BIGSERIAL.
--   2. Build text → bigint lookup table.
--   3. For each FK pointing at this table, add a new bigint FK column,
--      populate it via JOIN, drop the old text FK, rename.
--   4. Drop old text id, rename new_id to id, mark PRIMARY KEY.
```

Phase 2 is its own design doc — too much surface to nail down here.

---

## 4. Sync plugin rewire

This section is mostly about Phase 1 — Phase 2 is a much smaller follow-up rewire (just swap the wire format from `text` to `bigint` for `id` and any FK fields).

### 4.1 What changes in the Legend State store

Today (`apps/expo/features/packs/store/packs.ts`):

```ts
export const packsStore = observable<Record<string, PackInStore>>({});
// keyed by id (== nanoid())
```

After Phase 1, the **local key becomes `clientUuid`**. The server `id` is just another field on the record, populated after sync.

```ts
// New PackInStore shape
type PackInStore = {
  id?: string;                  // server id, populated after first sync
  clientUuid: string;           // local PK, never changes
  // ... existing fields ...
};

export const packsStore = observable<Record<string, PackInStore>>({});
// keyed by clientUuid
```

`useCreatePack` mints `clientUuid` via `nanoid()`. Nothing else changes:

```ts
// apps/expo/features/packs/hooks/useCreatePack.ts
export function useCreatePack() {
  return useCallback((packData: PackInput) => {
    const clientUuid = nanoid();
    const timestamp = new Date().toISOString();
    const newPack: PackInStore = {
      clientUuid,
      ...packData,
      localCreatedAt: timestamp,
      localUpdatedAt: timestamp,
      deleted: false,
    };
    obs(packsStore, clientUuid).set(newPack);
    return clientUuid;
  }, []);
}
```

### 4.2 `syncedCrud` config — `transform` + `as` hooks

`syncedCrud` is configured with `list`, `create`, `update` functions. The two places we need to teach it about the split:

1. **Sending a create:** wire format sends `clientUuid` (server mints id).
2. **Receiving the create response:** server returns `{ id, clientUuid, ... }`. We need to write `id` into the local row keyed by `clientUuid`.

`syncedCrud` already handles writing the response back into the observable. The local key stays `clientUuid` because that's what was used in the `obs(store, clientUuid).set(...)` call. The newly-arrived server `id` just becomes another field.

```ts
// apps/expo/features/packs/store/packs.ts (after Phase 1)
const createPack = async (packData: PackInStore): Promise<PackInStore | null> => {
  const { data, error } = await apiClient.packs.post({
    clientUuid: packData.clientUuid,        // <-- changed
    name: packData.name,
    description: packData.description ?? undefined,
    category: packData.category ?? undefined,
    isPublic: packData.isPublic,
    image: packData.image,
    tags: packData.tags ?? undefined,
    localCreatedAt: packData.localCreatedAt ?? new Date().toISOString(),
    localUpdatedAt: packData.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create pack: ${error.value}`);
  // Response has { id, clientUuid, ... }. Returning it overwrites the local row
  // keyed by clientUuid — `id` now lands on the record.
  return PackWithWeightsSchema.parse(data) as unknown as PackInStore;
};

const updatePack = async ({ clientUuid, id, ...data }: Partial<PackInStore>) => {
  if (!id) {
    // Local row exists but hasn't been synced yet — retry later.
    // syncedCrud will re-call us once create resolves.
    throw new Error('Cannot update pack before initial sync settles');
  }
  const { data: result, error } = await apiClient.packs({ packId: String(id) }).put({
    /* ... unchanged ... */
  });
  if (error) throw new Error(`Failed to update pack: ${error.value}`);
  return PackWithWeightsSchema.parse(result) as unknown as PackInStore;
};
```

Two things to call out:

- **`updatePack` blocks until `create` settles.** `syncedCrud` already serializes create-then-update for a given key (it tracks pending writes), so throwing here just defers the update; the plugin retries with `backoff: 'exponential'`. The alternative is to PATCH by `clientUuid` server-side, which we keep on the table as an idempotency convenience but don't rely on for normal flow.
- **`changesSince: 'last-sync'` keeps working.** It's keyed off `updatedAt`, not `id`.

### 4.3 Pack items — the FK edge

Pack items reference packs via `packId`. In the offline window, the parent pack may not yet have a server `id`.

The store keeps two coordinates per `packItem`:

```ts
type PackItem = {
  id?: string;                  // server id (post-sync)
  clientUuid: string;           // local PK
  packId?: string;              // server pack id (post-sync of the parent pack)
  packClientUuid: string;       // local pack PK — never changes
  // ... existing fields ...
};
```

The store is keyed by `packItem.clientUuid`. Queries like "items in pack X" use `packClientUuid`:

```ts
// apps/expo/features/packs/store/packItems.ts
export function getPackItems(packClientUuid: string) {
  return Object.values(packItemsStore.get()).filter(
    (item) => item.packClientUuid === packClientUuid && !item.deleted,
  );
}
```

On create, the client sends both:

```ts
const createPackItem = async ({ packClientUuid, packId, ...data }: PackItem) => {
  // We need a server packId to address the route; block if the parent isn't synced.
  if (!packId) {
    throw new Error('Cannot create pack item before parent pack syncs');
  }
  const { data: result, error } = await apiClient
    .packs({ packId: String(packId) })
    .items.post({
      clientUuid: data.clientUuid,
      // packId comes from the URL path, not the body
      name: data.name,
      // ... unchanged ...
    });
  if (error) throw new Error(`Failed to create pack item: ${error.value}`);
  return PackItemSchema.parse(result) as unknown as PackItem;
};
```

`syncedCrud` retries on the thrown error, so this naturally drains in topological order: pack creates first, then its items.

**Alternative considered:** Resolve `packId` from `packClientUuid` inside `createPackItem` by reading `packsStore`. Rejected because it adds a cross-store dependency at the plugin layer and makes errors harder to attribute. The retry-on-not-synced approach keeps each store responsible for its own contract.

### 4.4 Backfill on first launch after upgrade

Old local rows in the persisted store have `id` but no `clientUuid`. On boot, a one-shot migration in `persistPlugin` copies `id → clientUuid` for every row in every affected store, re-keys the record under `clientUuid`, and bumps a `schemaVersion`. After the migration the local store looks exactly like a fresh install except that `id` is already populated (so the server can recognize the row on next sync by `clientUuid` lookup — see [§5.3](#53-server-side-upsert-on-client_uuid)).

Pseudocode:

```ts
// apps/expo/lib/persist-plugin/migrations.ts
export function migrateToClientUuid(state: Record<string, any>) {
  const next: Record<string, any> = {};
  for (const row of Object.values(state)) {
    const clientUuid = row.clientUuid ?? row.id;
    next[clientUuid] = { ...row, clientUuid, id: row.id };
  }
  return next;
}
```

---

## 5. API surface change

### 5.1 Request shape

POST endpoints stop accepting `id`. They accept optional `clientUuid` instead:

```ts
// packages/api/src/routes/packs/index.ts (after Phase 1)
const CreatePackBodySchema = CreatePackRequestSchema.extend({
  clientUuid: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  localCreatedAt: z.string(),
  localUpdatedAt: z.string(),
});
```

The handler:

```ts
const clientUuid = data.clientUuid ?? mintId('p');  // lean callers (MCP/CLI/web)

const [newPack] = await db
  .insert(packs)
  .values({
    clientUuid,
    // id is omitted — Postgres sequence fills it (Phase 2) OR mintId('p') still
    // sets it (Phase 1, because id is still text PK)
    userId: user.userId,
    // ... unchanged ...
  })
  .onConflictDoUpdate({ target: packs.clientUuid, set: { /* ... */ } })  // see §5.3
  .returning();
```

`mintId(prefix)` survives Phase 1 as the lean-caller default for `clientUuid`. In Phase 2 it gets renamed to `mintClientUuid` and stops being used to fill the server PK.

### 5.2 Response shape

Every response that returns a row gains `clientUuid` alongside `id`. GET shapes otherwise unchanged. The Zod response schemas in `packages/api/src/schemas/packs.ts`, `trips.ts`, etc. add `clientUuid: z.string()`.

```ts
// packages/api/src/schemas/packs.ts (after Phase 1)
export const PackSchema = z.object({
  id: z.string(),                  // Phase 1: still text; Phase 2: z.number()
  clientUuid: z.string(),          // new
  // ... unchanged ...
});
```

### 5.3 Server-side upsert on `client_uuid`

Idempotency: a retry of a `POST /packs` with the same `clientUuid` must return the existing row, not 409 or duplicate.

```ts
.onConflictDoNothing({ target: packs.clientUuid })
.returning();

// then:
const pack = await db.query.packs.findFirst({ where: eq(packs.clientUuid, clientUuid) });
```

Or `onConflictDoUpdate` if we want retries to refresh `localUpdatedAt`. Either way, the contract is: same `clientUuid` → same `id`.

### 5.4 Route versioning?

**Recommendation: transition in place, no `/v2/` prefix.**

Reasons:

- The wire format is *additive* in Phase 1: we add `clientUuid` request/response, we don't remove `id` (it's still on the response). Old clients that send `id` still work — the server treats it as `clientUuid` for one release. Add a deprecation log line + a `Sunset` header per RFC 8594.
- New clients (post-PR) send `clientUuid`. We coexist on the same routes for a 60-day window.
- Phase 2 is where `id` changes type, and by then the surviving client codepaths are all using `clientUuid` for sync and `id` for joins.

Compatibility shim for one release window:

```ts
const clientUuid = data.clientUuid ?? data.id ?? mintId('p');
if (data.id && !data.clientUuid) {
  // log: "deprecated_id_field", userId, route
}
```

Once mobile telemetry shows zero callers sending `id`-only, drop the shim.

---

## 6. Foreign keys in the offline window

The FK columns (`pack_items.pack_id`, `trips.pack_id`, `trail_condition_reports.trip_id`) need a clear contract while the parent row hasn't synced yet.

### What the FK column holds locally

| State                                     | Local `packId`         | Local `packClientUuid` |
| ----------------------------------------- | ---------------------- | ---------------------- |
| Item created offline; pack not synced     | `undefined`            | `"abc123..."`          |
| Pack synced; item not yet pushed          | `"p_xxxxx"` (Phase 1)  | `"abc123..."`          |
| Both synced                               | `"p_xxxxx"` (Phase 1)  | `"abc123..."`          |

The local store always has `packClientUuid` (the stable local reference). It has `packId` only when the parent has synced. The store performs all "items in pack X" queries via `packClientUuid`. The server-bound API call uses `packId`.

### Why we keep both fields, not "swap on sync"

A pure swap (i.e., field always called `packId`, contains uuid pre-sync and server id post-sync) is brittle:

1. The semantic type changes mid-row-lifecycle (text id → text id of different format → eventually bigint).
2. Any local-only references (deep links, navigation state) break when the swap happens, requiring an event-driven re-link.
3. Queries can't tell which form is in the field without a heuristic on prefix.

Keeping both fields is verbose but unambiguous: `packClientUuid` is always present, `packId` is present iff parent has synced.

### Server-side: do FKs reference `id` or `client_uuid`?

**FKs reference `id`.** Always. `client_uuid` exists only at the row's own level. The server never accepts a `clientUuid` for a FK position — the client must resolve it locally to a server `id` before making the call.

Edge case: what if the client tries to create a pack item where the parent pack is mid-sync? Two options:

- **Block (recommended):** Throw in the local create handler; `syncedCrud` retries with backoff. Drains naturally.
- **Server-side lookup:** Accept `parentClientUuid` as a body field, look up the server `id`, write it to the FK. More flexible but bleeds the split through the API.

Recommend "block" for now. Revisit if we see a class of retry storms in telemetry.

### What about `trail_condition_reports.tripId` (`ON DELETE SET NULL`)?

Unchanged conceptually. The DB action stays `SET NULL`. The client doesn't get a notification — the report just appears with `tripId: null` on next sync. Same as today.

---

## 7. Rollback story

### Phase 1

**Schema:** Each table's change is `ADD COLUMN client_uuid` + `UPDATE` backfill + `ADD CONSTRAINT UNIQUE`. The down migration is literally `DROP COLUMN client_uuid`. Drizzle generates this automatically if we write the up migration well.

**API:** The compat shim (§5.4) means rolling back the API to a `id`-only client doesn't break new clients — they keep sending `clientUuid` and the server still recognizes it. Rolling forward then back then forward is safe.

**Mobile:** The persisted-store migration is one-way (copies `id` into `clientUuid`). Rolling back the mobile app to a pre-split build means the user's local rows still have `id`, just unused — the old build ignores `clientUuid` and keeps working off `id`. No data loss.

Net: rollback is safe at every layer if we land the migration as Phase 1 only.

### Phase 2

This is the irreversible one — once `packs.id` is `bigint`, going back to `text` requires re-minting old-format IDs. We accept this. Phase 2 only lands when Phase 1 telemetry is clean.

---

## 8. Open questions

These need Andrew's call before implementation starts:

1. **`bigserial` vs `UUIDv7` for server id.** I recommended `bigserial` for index locality and storage. UUIDv7 is the alternative if we want opaque external IDs. Either way the design is the same; only the column type differs in Phase 2.
2. **Phase 2 timing.** Days or weeks after Phase 1? Specifically: how long do we wait on telemetry before pulling the trigger on the irreversible PK type change?
3. **Backfill batch size for the persisted-store migration.** The Legend State persisted store can be large (every pack item ever). Do we migrate eagerly on first launch (blocks UI for a beat) or lazily as records are read?
4. **MCP / CLI behaviour.** Today T9 lets them omit `id`. After Phase 1, do they omit `clientUuid` too (server mints) or do they generate one? I lean "server mints" because they have no offline-first concerns — keeps the offline-first ID surface narrow to the mobile app.
5. **Trail condition reports — same shape?** They follow the same offline-first pattern, but are they shipping in the next release cycle? If they're pre-launch we have more freedom to make breaking changes. Confirm.
6. **Trip lifecycle.** `trips.packId` is `ON DELETE SET NULL`. If we swap to a bigint, that nullable FK is fine. But: do we expect users to have pre-existing trips referencing packs that no longer exist? Spot-check the data before Phase 2.
7. **Existing similar abstraction?** I couldn't find a `clientUuid`-style column anywhere in `packages/api/src/db/schema.ts`. There's a precedent for the UUID-PK migration pattern itself (`drizzle/0040_uuid_pk_better_auth_migration.sql` through `0045`), which we should mimic stylistically. If Andrew remembers anything I missed, flag it.
8. **Do we want a public-facing `slug` or `share_id` for pack share URLs?** Currently share URLs use `packs.id`. If we go `bigserial`, exposing `42` is ugly. Out of scope for this design — calling it out so we don't paint ourselves into a corner.

---

## 9. Implementation plan

Six shippable PRs, in order. Each PR is independently revertable and leaves the system in a consistent state.

### PR 1 — Schema shim (Phase 1 DB)  *[shipping in plan 2026-05-17-001]*

- Add `client_uuid` column to seven tables.
- Backfill from existing `id`.
- Add `UNIQUE` constraint and format CHECK.
- Drizzle migration only; no code changes touching it yet.

**Risk:** Low. Reversible by dropping the column.
**Touches:** `packages/api/drizzle/00XX_add_client_uuid.sql`, `packages/api/src/db/schema.ts`.

### PR 2 — API: accept and return `clientUuid`  *[shipping in plan 2026-05-17-001]*

- Update Zod request schemas to accept optional `clientUuid`.
- Update handlers to use `data.clientUuid ?? data.id ?? mintId(prefix)`.
- Add `onConflictDoNothing(target: clientUuid)` for idempotency.
- Update response schemas to include `clientUuid`.
- Add deprecation log for `id`-only requests.

**Risk:** Low. Additive on the wire.
**Touches:** `packages/api/src/routes/{packs,trips,packTemplates,trailConditions}/*.ts`, `packages/api/src/schemas/*.ts`, `packages/api/src/utils/ids.ts` (rename `mintId` semantics in comments).

### PR 3 — Mobile: persisted store migration + read by `clientUuid`  *[deferred — own plan]*

- `persistPlugin` migration: copy `id → clientUuid`, re-key store records.
- Update `PackInStore`, `PackItem`, `TripInStore`, etc. types to include `clientUuid`.
- Update `useCreatePack`, `useCreatePackItem`, etc. to mint `clientUuid` instead of `id`.
- Update `getPackItems`-style queries to filter by `packClientUuid`.
- Don't touch sync wire format yet — `id` is still the field name on the wire.

**Risk:** Medium. Persisted-store migration is one-way. Test on a representative dataset.
**Touches:** `apps/expo/features/packs/store/*.ts`, `apps/expo/features/packs/hooks/*.ts`, `apps/expo/features/{trips,trail-conditions,pack-templates}/store/*.ts`, `apps/expo/lib/persist-plugin/*.ts`, `apps/expo/features/packs/types.ts` and siblings.

### PR 4 — Mobile: switch sync wire format to `clientUuid`  *[deferred — own plan]*

- Update `createPack`, `createPackItem`, `createTrip`, etc. in the stores to send `clientUuid` on the wire.
- Update `updatePack`, `updatePackItem`, etc. to throw-and-retry when local row has no server `id` yet.
- Keep `id` on the response as the server-owned identifier; populate it into the local row on first sync return.

**Risk:** Medium. Watch for retry storms in telemetry.
**Touches:** Same files as PR 3.

### PR 5 — API: drop the `id`-on-create compatibility shim  *[deferred — waits on PR 4 + 30 days clean telemetry]*

- Remove `data.id ?? data.clientUuid` fallback.
- Force `clientUuid` (server can still mint).
- Bump the API minor version, update OpenAPI docs.

**Risk:** Low if PR 3+4 have shipped to 100% of users for at least one release cycle.
**Touches:** `packages/api/src/routes/*/*.ts`, `packages/api/src/schemas/*.ts`.

### PR 6 — Phase 2: narrow `id` to `bigserial`, rewrite FKs

- Big-bang DB migration for the seven tables.
- Update Drizzle schema types.
- Update API handlers to read `id` as `number`.
- Update mobile to handle numeric server `id`.

**Risk:** High. Plan a maintenance window. Have a rollback runbook. Backup the DB.
**Touches:** Everything that references `id` on these seven tables.

Phase 2 (PR 6) is **a separate design doc** — too much surface to nail down here. Mentioning it for completeness; the meat of *this* design is PRs 1-5.

---

## Appendix A — Files touched (current understanding)

Cited so reviewers can trace the design back to ground truth:

- **Schema:** `packages/api/src/db/schema.ts` (lines 110-380 for affected tables; user/auth tables untouched).
- **Routes:** `packages/api/src/routes/packs/index.ts`, `routes/trips/index.ts`, `routes/packTemplates/index.ts`, `routes/trailConditions/reports.ts`.
- **Schemas (Zod):** `packages/api/src/schemas/packs.ts`, `schemas/trips.ts`, `schemas/packTemplates.ts`.
- **ID helper:** `packages/api/src/utils/ids.ts` (introduced in T9).
- **Mobile stores:** `apps/expo/features/packs/store/{packs,packItems,packWeightHistory}.ts`, `features/trips/store/trips.ts`, `features/trail-conditions/store/trailConditionReports.ts`, `features/pack-templates/store/*.ts`.
- **Mobile hooks:** `apps/expo/features/packs/hooks/{useCreatePack,useCreatePackItem,useCreatePackFromPack}.ts`.
- **Persist plugin:** `apps/expo/lib/persist-plugin/*.ts`.
- **Drizzle migrations:** `packages/api/drizzle/` (existing UUID PK migration `0040_*.sql` is a good stylistic template).

## Appendix B — Why not "just make `id` a UUIDv7 server-side and drop client-supplied IDs entirely"

Tempting, but breaks offline-first:

1. The Legend State store needs a stable local key the instant `useCreatePack` returns. Without one, the create button on mobile can't navigate to the new pack's screen until the network round-trip completes — that's the bug this whole architecture exists to avoid.
2. Even if we generated a UUIDv7 client-side, we'd still face the dual-ownership problem the moment two clients (mobile + web) generate IDs concurrently for the same logical row. `client_uuid` solves this by being explicitly local-scoped: it's an idempotency token, not a shared identifier.

The client-supplied ID has to exist for offline-first to work. The design choice is whether it's *also* the PK (status quo, hacky) or a separate idempotency column (this design, clean).
