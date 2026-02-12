---
title: "feat: Implement Swarm Board API + CLI"
type: feat
date: 2026-02-12
---

# Implement Swarm Board — API-First Task Coordination for Multi-Agent Systems

## Overview

Build the complete Swarm Board system: a Bun workspace monorepo with three packages — `@swarmboard/shared` (TypeBox schemas, types, invariants), `@swarmboard/api` (Elysia + Cloudflare Worker + R2), and `@swarmboard/cli` (citty + Eden Treaty). The system provides a REST API for agents to coordinate work through a kanban-style board backed by a single `board.json` in R2, with per-story comment threads in separate files.

## Problem Statement / Motivation

Multi-agent systems currently coordinate through unstructured channels (Discord, Slack), creating a "fog of war" where no single participant — human or agent — has a reliable view of work state. Swarm Board replaces this with a structured, API-first coordination layer that any HTTP-capable agent can interact with. The CLI gives humans the same view agents have.

## Proposed Solution

Three-package Bun workspace monorepo:

1. **`@swarmboard/shared`** — TypeBox schemas defining the board, story, comment, and agent data models. Business invariant enforcement functions. Zero external coupling — usable by both API and CLI.

2. **`@swarmboard/api`** — Elysia app compiled for Cloudflare Workers via `CloudflareAdapter`. Routes for story CRUD, comments, claims, board init/export, and agent registry. R2 storage layer with ETag-based optimistic concurrency. Auth via shared Bearer token + `X-Agent` header.

3. **`@swarmboard/cli`** — citty-based CLI (`sb`) using Eden Treaty for type-safe API calls. Config via env vars or `~/.config/swarmboard/config.json`. Human-readable formatted output via consola.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Cloudflare                        │
│                                                      │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │  CF Worker    │◄───────►│  R2 Bucket           │  │
│  │  Elysia +    │  read/  │  ├── board.json      │  │
│  │  Compile()   │  write  │  └── comments/        │  │
│  │               │         │      ├── US-001.json  │  │
│  │               │         │      └── US-NNN.json  │  │
│  └──────┬───────┘         └──────────────────────┘  │
│         │                                            │
└─────────┼────────────────────────────────────────────┘
          │ HTTPS
          │
    ┌─────┴──────────────────────────┐
    │                                │
┌───┴───┐  ┌────────┐  ┌────────┐  ┌┴───────┐
│  CLI   │  │Agent 1 │  │Agent 2 │  │Agent N │
│(human) │  │        │  │        │  │        │
└────────┘  └────────┘  └────────┘  └────────┘
```

**Key design decisions:**
- Single `board.json` file in R2 — all story metadata + agent registry
- Separate `comments/{story-id}.json` files — independent ETags, no write contention with board mutations
- ETag-based optimistic concurrency via R2's `onlyIf: { etagMatches }` conditional PUT (no TOCTOU race)
- Elysia's TypeBox schemas shared with CLI via workspace dependency — change API, get CLI type errors immediately
- Eden Treaty provides zero-codegen type-safe client from exported `type App`

### Design Decisions (Resolving Spec Gaps)

These decisions resolve ambiguities identified during spec analysis:

| Gap | Decision | Rationale |
|-----|----------|-----------|
| **Status transitions** | All transitions allowed (permissive) | Agents and PM need flexibility. Only 4 invariants enforced (passes/done sync, in_progress requires assignee, assign promotes todo). Anything else is the PM agent's responsibility. |
| **Unclaim from in_progress** | Auto-reverts status to `todo`, clears assignee | Invariant requires `in_progress` have an assignee. Reverting to `todo` is the safe default. Agents can PATCH to a different status first if needed. |
| **PATCH assignee vs. claim** | PATCH with assignee triggers same invariants as claim (auto-promote todo→in_progress). PATCH does NOT reject if already assigned — that's claim-specific. | PM agent needs to reassign via PATCH without 409. Claim is the agent-safe "try to take" primitive. |
| **Uninitialized board** | All non-init endpoints return `404` with `{ error: "board_not_initialized", message: "Call POST /board/init first" }` | Clear signal to agents/CLI that init is required. |
| **Re-init existing board** | `POST /board/init` returns `409` if board.json already exists | Prevents accidental data loss. Future: add `POST /board/reset` with confirmation. |
| **Story deletion** | No deletion in v1. Filter by status to manage growth. | Spec explicitly defers this. Stories persist. |
| **`sb log` implementation** | Reconstructed client-side: fetch all stories sorted by `updated_at`, interleave with recent comments | No audit log endpoint needed. CLI reads board + comments and merges by timestamp. |
| **`dependsOn` validation** | Stored but not enforced. No cycle detection. | PM agent's responsibility to reason about dependencies. System is a data store, not a workflow engine. |
| **X-Agent header** | Required on mutating requests (POST/PATCH). Optional on GET. Missing on mutation → `400`. Defaults to `"unknown"` on GET. | Mutations need attribution. Reads should be frictionless. |
| **Health check** | `GET /health` returns `{ status: "ok" }` without auth | Needed for monitoring and load balancer probes. |
| **Agent auto-registration** | First request with a new X-Agent slug auto-creates registry entry with `status: "active"`, `description: ""`, `last_seen: now()` | Zero friction agent onboarding. PM can update descriptions later. |
| **Error response format** | All errors: `{ error: "<code>", message: "<human-readable>", retry?: boolean }` | Machine-parseable `error` code + human `message`. `retry: true` on 409s. |

### Implementation Phases

#### Phase 1: Monorepo Scaffold + Shared Package

**Goal:** Working workspace with shared types, schemas, and tested invariants.

**Tasks:**

- [x] Set up Bun workspace root: `package.json` (workspaces), `tsconfig.json` (base composite), `biome.json`, `bunfig.toml`
  - `package.json` — workspace scripts: `dev`, `deploy`, `test`, `lint`, `lint:fix`, `typecheck`
  - `biome.json` — tabs, 100 line width, recommended rules, organize imports
- [x] Create `packages/shared/` structure
  - `packages/shared/package.json` — depends on `@sinclair/typebox`
  - `packages/shared/tsconfig.json` — extends base
  - `packages/shared/src/constants.ts` — `STORY_STATUSES` array, `AGENT_STATUSES` array, ID prefixes (`US-`, `c-`)
  - `packages/shared/src/schema.ts` — TypeBox schemas: `StoryStatus`, `AgentStatus`, `StorySchema`, `CommentSchema`, `AgentSchema`, `BoardSchema`, `CreateStoryBody`, `UpdateStoryBody`, `CreateCommentBody`
  - `packages/shared/src/types.ts` — `Static<>` type exports: `Story`, `Comment`, `Agent`, `Board`, `StoryStatusType`
  - `packages/shared/src/invariants.ts` — `enforceInvariants(current, updates)` function
  - `packages/shared/src/index.ts` — barrel export
- [x] Write unit tests for shared package
  - `packages/shared/src/__tests__/invariants.test.ts`:
    - `passes: true` auto-sets `status: done`
    - `status: done` auto-sets `passes: true`
    - `status: in_progress` without assignee returns error
    - Assigning a `todo` story auto-promotes to `in_progress`
    - Assigning an `in_progress` story does not change status
    - Setting `passes: false` (un-done) auto-sets `status` to `todo` (or leaves unchanged if not `done`)
  - `packages/shared/src/__tests__/schema.test.ts`:
    - Valid story passes validation
    - Missing required fields fail
    - Invalid status value fails
    - Priority out of range (1-5) fails
- [x] Run `bun install` at root — verify workspace linking works
- [x] Run `bun test` in shared — all tests pass

**Files created:**

```
package.json (root)
tsconfig.json (root)
biome.json
bunfig.toml
packages/shared/package.json
packages/shared/tsconfig.json
packages/shared/src/index.ts
packages/shared/src/constants.ts
packages/shared/src/schema.ts
packages/shared/src/types.ts
packages/shared/src/invariants.ts
packages/shared/src/__tests__/invariants.test.ts
packages/shared/src/__tests__/schema.test.ts
```

#### Phase 2: API Storage Layer

**Goal:** R2 read/write modules for board.json and comments with ETag-based concurrency. Tested with wrangler dev / miniflare.

**Tasks:**

- [x] Create `packages/api/` structure
  - `packages/api/package.json` — depends on `elysia`, `@swarmboard/shared`; devDeps: `wrangler`, `@cloudflare/workers-types`
  - `packages/api/tsconfig.json` — extends base, adds `@cloudflare/workers-types` to types
  - `packages/api/wrangler.jsonc` — worker name `swarmboard-api`, R2 binding `BOARD_BUCKET` → bucket `swarmboard-data`, compatibility_date (check Elysia CF docs for minimum)
- [x] Implement `packages/api/src/storage/board.ts`
  - `readBoard()` — reads `board.json` from R2, returns `{ board, etag }` or `null`
  - `writeBoard(board, expectedEtag)` — writes with `onlyIf: { etagMatches }`, returns `{ ok: true, etag }` or `{ ok: false, reason: 'conflict' }`
  - Access R2 via `import { env } from 'cloudflare:workers'` pattern
- [x] Implement `packages/api/src/storage/comments.ts`
  - `readComments(storyId)` — reads `comments/{storyId}.json`, returns `{ comments, etag }` or `{ comments: [], etag: null }` if file doesn't exist
  - `writeComments(storyId, comments, expectedEtag)` — writes with conditional ETag. For first comment (no existing file), uses unconditional write
  - `appendComment(storyId, comment, expectedEtag)` — reads, appends, writes atomically
- [x] Implement `packages/api/src/types.ts` — `Env` interface for R2 bucket binding, `ApiError` type
- [x] Write storage integration tests
  - `packages/api/src/__tests__/storage.test.ts`:
    - Read non-existent board returns null
    - Write then read returns same data with ETag
    - Write with wrong ETag returns conflict
    - Comments: read empty returns `[]`
    - Comments: write first comment creates file
    - Comments: write with wrong ETag returns conflict

**Files created:**

```
packages/api/package.json
packages/api/tsconfig.json
packages/api/wrangler.jsonc
packages/api/src/types.ts
packages/api/src/storage/board.ts
packages/api/src/storage/comments.ts
packages/api/src/__tests__/storage.test.ts
```

#### Phase 3: API Auth Middleware + Agent Registry

**Goal:** Bearer token auth, X-Agent extraction, auto-registration in agent registry, last_seen updates.

**Tasks:**

- [x] Implement `packages/api/src/middleware/auth.ts`
  - Skip auth for `GET /health`
  - Validate Bearer token against `env.API_KEY` secret
  - Extract `X-Agent` header — required on POST/PATCH, optional on GET (defaults to `"unknown"`)
  - Return `401` with error body if token missing/invalid
  - Return `400` if X-Agent missing on mutation
  - Derive `{ agent: string }` into Elysia context
- [x] Implement `packages/api/src/middleware/etag.ts`
  - Helper: `requireEtag(headers)` — extracts `If-Match`, returns 428 if missing on mutations
  - Helper: `conflictResponse()` — standardized 409 body with `retry: true`
- [x] Implement agent auto-registration in board storage
  - On every authenticated request, update `agents[slug].last_seen` and `agents[slug].status = "active"`
  - If agent not in registry, create entry with empty description
  - This runs as part of the middleware/afterHandle, writing back to board.json
  - Note: agent registry updates should piggyback on board writes (not separate writes) to avoid doubling R2 operations. For GET requests, skip registry update (read-only).
- [x] Write auth middleware tests
  - Missing token → 401
  - Invalid token → 401
  - Valid token → passes through
  - X-Agent extracted into context
  - Missing X-Agent on POST → 400
  - Missing X-Agent on GET → defaults to "unknown"

**Files created:**

```
packages/api/src/middleware/auth.ts
packages/api/src/middleware/etag.ts
packages/api/src/__tests__/auth.test.ts
```

#### Phase 4: Story CRUD Routes

**Goal:** GET/POST /stories, GET/PATCH /stories/:id with full invariant enforcement.

**Tasks:**

- [x] Implement `packages/api/src/routes/stories.ts`
  - `GET /stories` — query filters: `status` (comma-separated), `assignee` (`unassigned` for null), `category`, `priority_lte`. Returns `{ userStories, etag }`
  - `GET /stories/:id` — returns story object + ETag. 404 if not found
  - `POST /stories` — requires `If-Match` board ETag. Auto-generates sequential `US-XXX` ID, sets `status: backlog`, `passes: false`, `created_at/updated_at`. Returns 201
  - `PATCH /stories/:id` — requires `If-Match` board ETag. Applies `enforceInvariants()`. Updates `updated_at` on story and board root. Returns updated story. 404 if story not found. 409 if ETag mismatch
  - All mutating routes update agent `last_seen` in registry (piggybacked on board write)
- [x] Write story route tests via Eden Treaty instance-passing
  - `packages/api/src/__tests__/stories.test.ts`:
    - List empty board → empty array
    - Create story → 201 with auto-generated ID
    - Create story → ID is sequential (US-001, US-002, ...)
    - Get story by ID → returns story
    - Get non-existent story → 404
    - Patch story status → status updated
    - Patch passes:true → status auto-set to done
    - Patch status:done → passes auto-set to true
    - Patch in_progress without assignee → error
    - Patch assignee on todo story → auto-promotes to in_progress
    - Patch with stale ETag → 409
    - Filter by status → returns matching
    - Filter by assignee → returns matching
    - Filter assignee=unassigned → returns null-assignee stories

**Files created:**

```
packages/api/src/routes/stories.ts
packages/api/src/__tests__/stories.test.ts
```

#### Phase 5: Comment Routes

**Goal:** GET/POST /stories/:id/comments with independent ETag from board.

**Tasks:**

- [x] Implement `packages/api/src/routes/comments.ts`
  - `GET /stories/:id/comments` — reads `comments/{id}.json`. Returns `{ comments: [...], etag }`. Empty array + null etag if no file
  - `POST /stories/:id/comments` — requires `If-Match` comments ETag (or `*` for first comment). Auto-generates `c-XXX` ID, sets `at` timestamp, `agent` from X-Agent header. Creates file if first comment. Returns 201 + new comment + new ETag
  - Verify story exists in board.json before allowing comment creation (404 if story doesn't exist)
- [x] Write comment route tests
  - `packages/api/src/__tests__/comments.test.ts`:
    - Get comments on story with no comments → empty array
    - Post first comment (If-Match: *) → 201, creates file
    - Post second comment with correct ETag → 201
    - Post comment with stale ETag → 409
    - Post comment on non-existent story → 404
    - Comment has auto-generated ID, timestamp, agent slug

**Files created:**

```
packages/api/src/routes/comments.ts
packages/api/src/__tests__/comments.test.ts
```

#### Phase 6: Claim/Unclaim Routes

**Goal:** Atomic claim/unclaim primitives with conflict detection.

**Tasks:**

- [x] Implement `packages/api/src/routes/claims.ts`
  - `POST /stories/:id/claim` — requires board ETag. Checks story.assignee is null → sets assignee to X-Agent, auto-promotes todo→in_progress. Returns 409 if already assigned. Returns updated story + new ETag
  - `POST /stories/:id/unclaim` — requires board ETag. Checks story.assignee === X-Agent header → clears assignee, reverts in_progress→todo. Returns 403 if X-Agent doesn't match current assignee. Returns updated story + new ETag
- [x] Write claim/unclaim tests
  - `packages/api/src/__tests__/claims.test.ts`:
    - Claim unassigned todo story → assignee set, status in_progress
    - Claim unassigned backlog story → assignee set, status in_progress
    - Claim already-assigned story → 409
    - Claim with stale ETag → 409
    - Unclaim own story from in_progress → assignee null, status todo
    - Unclaim someone else's story → 403
    - Unclaim story not in_progress → assignee null, status unchanged

**Files created:**

```
packages/api/src/routes/claims.ts
packages/api/src/__tests__/claims.test.ts
```

#### Phase 7: Board Routes (Init, Export, Overview)

**Goal:** Board initialization (with Ralph migration), export in both formats, health check.

**Tasks:**

- [x] Implement `packages/api/src/migration.ts`
  - `migrateFromRalph(prdJson)` — detects Ralph format (has `userStories` without `status`/`assignee`), adds extension fields: `status: backlog`, `assignee: null`, `created_at/updated_at: now()`. Preserves all Ralph-native fields
  - Detection heuristic: if any story lacks a `status` field, treat as Ralph format
- [x] Implement `packages/api/src/routes/board.ts`
  - `GET /health` — returns `{ status: "ok" }` (no auth)
  - `GET /board` — returns full board.json + ETag. 404 if not initialized
  - `POST /board/init` — accepts board body or Ralph prd.json. Runs migration if Ralph format detected. 409 if board already exists. Returns 201 + initialized board
  - `GET /board/export` — returns raw board.json with `Content-Disposition: attachment; filename="board.json"`
  - `GET /board/export/ralph` — strips extension fields (`status`, `assignee`, `created_at`, `updated_at` from stories; `agents` from root). Returns Ralph-compatible prd.json
- [x] Implement `packages/api/src/routes/agents.ts`
  - `GET /agents` — returns `{ agents: { ... } }` from board's agent registry
- [x] Write board route tests
  - `packages/api/src/__tests__/board.test.ts`:
    - GET /health → 200 ok
    - GET /board before init → 404
    - POST /board/init → 201, creates board
    - POST /board/init again → 409
    - POST /board/init with Ralph format → auto-migrates stories
    - GET /board/export → returns board.json
    - GET /board/export/ralph → strips extension fields
    - GET /agents → returns registry

**Files created:**

```
packages/api/src/migration.ts
packages/api/src/routes/board.ts
packages/api/src/routes/agents.ts
packages/api/src/__tests__/board.test.ts
```

#### Phase 8: API Entry Point + Compilation

**Goal:** Wire all routes into Elysia app with CloudflareAdapter and `.compile()`.

**Tasks:**

- [x] Implement `packages/api/src/index.ts`
  - Create Elysia app with `CloudflareAdapter`
  - Use auth middleware
  - Mount all route groups: board, stories, comments, claims, agents
  - Call `.compile()` for CF Worker AOT
  - Export `type App = typeof app` for Eden Treaty
  - Export default app
- [x] Verify with `wrangler dev` — all routes respond correctly
- [x] Run full API test suite: `bun test` in packages/api

**Files created:**

```
packages/api/src/index.ts
```

#### Phase 9: CLI Foundation

**Goal:** Config loading, Eden Treaty client factory, citty main command with subcommand skeleton.

**Tasks:**

- [x] Create `packages/cli/` structure
  - `packages/cli/package.json` — depends on `@elysiajs/eden`, `@swarmboard/shared`, `citty`, `consola`; devDeps: `elysia` (type-only)
  - `packages/cli/tsconfig.json` — extends base
- [x] Implement `packages/cli/src/config.ts`
  - Load from env vars: `SWARMBOARD_URL`, `SWARMBOARD_KEY`, `SWARMBOARD_AGENT`
  - Fallback: `~/.config/swarmboard/config.json`
  - Error message if neither configured
- [x] Implement `packages/cli/src/client.ts`
  - Eden Treaty client factory: `createClient()` → `treaty<App>(config.url, { headers })`
  - Headers: `Authorization: Bearer <key>`, `X-Agent: <agent>`
- [x] Implement `packages/cli/src/format.ts`
  - `formatStoryRow(story)` — table row: ID, priority, title (truncated), assignee
  - `formatStoryDetail(story, comments)` — full detail view (as shown in spec's example output)
  - `formatBoardSummary(board)` — bar chart of status counts (as shown in spec)
  - `formatAgentList(agents)` — table of agents with status and last_seen
  - `timeAgo(isoString)` — relative time formatting
- [x] Implement `packages/cli/src/retry.ts`
  - `withRetry(fn, maxRetries=3)` — exponential backoff with jitter for 409s
- [x] Implement `packages/cli/src/index.ts`
  - citty main command with meta (name: `sb`, version, description)
  - Register all subcommands via lazy imports
- [x] Write config + format tests
  - `packages/cli/src/__tests__/config.test.ts`:
    - Loads from env vars
    - Defaults agent to "human"
    - Throws if no config
  - `packages/cli/src/__tests__/format.test.ts`:
    - Formats story row correctly
    - Truncates long titles
    - timeAgo produces correct relative times

**Files created:**

```
packages/cli/package.json
packages/cli/tsconfig.json
packages/cli/src/index.ts
packages/cli/src/config.ts
packages/cli/src/client.ts
packages/cli/src/format.ts
packages/cli/src/retry.ts
packages/cli/src/__tests__/config.test.ts
packages/cli/src/__tests__/format.test.ts
```

#### Phase 10: CLI Read Commands

**Goal:** `sb board`, `sb list`, `sb show`, `sb agents`, `sb log` — the most-used commands.

**Tasks:**

- [x] Implement `packages/cli/src/commands/board.ts`
  - Calls `GET /board`, renders bar chart summary (status counts, story total, active agent count)
- [x] Implement `packages/cli/src/commands/list.ts`
  - Args: `--status`, `--assignee`, `--mine`, `--category`, `--json`
  - Calls `GET /stories` with query params
  - Renders table or JSON
- [x] Implement `packages/cli/src/commands/show.ts`
  - Positional arg: story ID
  - Parallel fetch: `GET /stories/:id` + `GET /stories/:id/comments`
  - Renders full detail view with comments
- [x] Implement `packages/cli/src/commands/agents.ts`
  - Calls `GET /agents`
  - Renders table: slug, status, description (truncated), last_seen (relative)
- [x] Implement `packages/cli/src/commands/log.ts`
  - Calls `GET /board` to get all stories
  - Sorts stories by `updated_at` descending
  - For the N most recent stories, fetches comments in parallel
  - Renders interleaved timeline: story updates + comments, sorted by timestamp
  - Default: last 20 entries. Flag: `--limit N`

**Files created:**

```
packages/cli/src/commands/board.ts
packages/cli/src/commands/list.ts
packages/cli/src/commands/show.ts
packages/cli/src/commands/agents.ts
packages/cli/src/commands/log.ts
```

#### Phase 11: CLI Write Commands

**Goal:** `sb add`, `sb edit`, `sb claim`, `sb unclaim`, `sb done`, `sb comment`.

**Tasks:**

- [x] Implement `packages/cli/src/commands/add.ts`
  - Positional arg: title
  - Flags: `--description`, `--category`, `--priority` (default 3), `--assignee`
  - Fetches board ETag, then `POST /stories` with `If-Match`
  - Retry on 409
- [x] Implement `packages/cli/src/commands/edit.ts`
  - Positional arg: story ID
  - Flags: `--status`, `--priority`, `--assignee`, `--title`, `--description`, `--category`, `--notes`
  - Fetches board ETag, then `PATCH /stories/:id` with `If-Match`
  - Retry on 409
- [x] Implement `packages/cli/src/commands/claim.ts`
  - Positional arg: story ID
  - Fetches board ETag, then `POST /stories/:id/claim` with `If-Match`
  - Retry on 409 (ETag conflict), display clear message on 409 (already assigned)
- [x] Implement `packages/cli/src/commands/unclaim.ts`
  - Positional arg: story ID
  - Fetches board ETag, then `POST /stories/:id/unclaim` with `If-Match`
- [x] Implement `packages/cli/src/commands/done.ts`
  - Positional arg: story ID
  - Fetches board ETag, then `PATCH /stories/:id` with `{ passes: true }` + `If-Match`
- [x] Implement `packages/cli/src/commands/comment.ts`
  - Positional args: story ID, message
  - Fetches comments ETag (GET /stories/:id/comments), then `POST /stories/:id/comments` with `If-Match` (or `*` if no comments yet)

**Files created:**

```
packages/cli/src/commands/add.ts
packages/cli/src/commands/edit.ts
packages/cli/src/commands/claim.ts
packages/cli/src/commands/unclaim.ts
packages/cli/src/commands/done.ts
packages/cli/src/commands/comment.ts
```

#### Phase 12: CLI Admin Commands

**Goal:** `sb init`, `sb export`.

**Tasks:**

- [x] Implement `packages/cli/src/commands/init.ts`
  - Flag: `--from <file.json>` — reads local JSON file
  - Without flag: prompts for project name and description, creates minimal board
  - Calls `POST /board/init`
  - Detects Ralph format automatically (same heuristic as API)
- [x] Implement `packages/cli/src/commands/export.ts`
  - Flag: `--ralph` — export Ralph-compatible format
  - Without flag: native board.json export
  - Writes to stdout (pipeable) or `--out <file>` flag

**Files created:**

```
packages/cli/src/commands/init.ts
packages/cli/src/commands/export.ts
```

#### Phase 13: CLI Bundling

**Goal:** Single-file distributable CLI binary.

**Tasks:**

- [x] Create `packages/cli/scripts/build.ts`
  - `Bun.build()` with `entrypoints: ['src/index.ts']`, `target: 'node'`, `minify: true`, `packages: 'bundle'`
  - Prepend `#!/usr/bin/env node` shebang to output
  - Output to `packages/cli/dist/index.mjs`
- [x] Update `packages/cli/package.json` bin field: `"sb": "./dist/index.mjs"`
- [x] Test: `bun run packages/cli/scripts/build.ts && ./packages/cli/dist/index.mjs --help`

**Files created:**

```
packages/cli/scripts/build.ts
```

#### Phase 14: CI/CD

**Goal:** GitHub Actions for lint, typecheck, test, and deploy.

**Tasks:**

- [x] Create `.github/workflows/ci.yml`
  - Trigger: push, pull_request
  - Steps: checkout, setup-bun, install, lint, typecheck, test
- [x] Create `.github/workflows/deploy.yml`
  - Trigger: push to main
  - Steps: checkout, setup-bun, install, test, wrangler deploy (packages/api)
  - Secret: `CF_API_TOKEN`

**Files created:**

```
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

## Acceptance Criteria

### Functional Requirements

- [x] `POST /board/init` creates a board from scratch or from Ralph prd.json
- [x] `GET /stories` returns filtered stories with ETag
- [x] `POST /stories` creates stories with auto-generated sequential IDs (US-001, US-002, ...)
- [x] `PATCH /stories/:id` enforces all 4 business invariants
- [x] `POST /stories/:id/claim` atomically claims unassigned stories (409 if taken)
- [x] `POST /stories/:id/unclaim` releases stories (403 if not current assignee, reverts in_progress→todo)
- [x] `POST /stories/:id/comments` writes to separate R2 file with independent ETag
- [x] Board ETag and comment ETags are fully independent — no cross-contention
- [x] `GET /board/export/ralph` produces valid Ralph prd.json (no extension fields)
- [x] Agent registry auto-registers new agents on first request
- [x] All CLI commands wrap corresponding API endpoints
- [x] CLI handles 409 retries transparently with exponential backoff

### Non-Functional Requirements

- [x] API response time < 100ms at edge (CF Worker cold start + R2 read)
- [x] All TypeBox schemas shared between API validation and CLI type inference
- [x] Eden Treaty provides compile-time type safety for all CLI→API calls
- [x] `bun test` passes for all three packages
- [x] `biome check .` passes with zero warnings

### Quality Gates

- [x] All business invariants have unit tests in `@swarmboard/shared`
- [x] All API routes have integration tests via Eden Treaty instance-passing
- [x] CLI config and formatting have unit tests
- [x] CI pipeline passes: lint + typecheck + test

## Dependencies & Prerequisites

- **Cloudflare account** with R2 bucket created (`swarmboard-data`)
- **Wrangler** installed globally or via devDeps (already available at user's system)
- **API key** stored as CF Worker secret: `wrangler secret put API_KEY`
- **Bun 1.3+** (user has 1.3.9)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Elysia CloudflareAdapter incompatibility | Medium | High | Pin Elysia version, test with `wrangler dev` early (Phase 2). Fall back to raw fetch handler if needed |
| R2 conditional PUT (`onlyIf`) behavior mismatch | Low | High | Test thoroughly in Phase 2. R2 docs confirm `onlyIf` support for conditional writes |
| ETag contention at scale (10+ concurrent agents) | Low (v1) | Medium | Acceptable for v1 with 12 agents. Upgrade path: Durable Object as write coordinator |
| Eden Treaty + CLI bundling conflicts | Medium | Medium | Test bundle early in Phase 13. Eden is designed for tree-shaking |
| `import { env } from 'cloudflare:workers'` availability | Low | High | Verify compatibility_date supports this pattern. Fallback: use handler context `env` parameter |

## Future Considerations

Explicitly **out of scope** for this plan but architecture supports:

- **Webhooks / SSE** — push notifications on story changes via CF Queue
- **Per-agent API keys** — replace shared key; enforce agents can only modify own stories
- **Web UI** — read-only dashboard consuming export endpoint
- **Multiple boards** — `board-{name}.json` files in same bucket
- **Audit log** — append-only event log for `sb log` (replaces comment reconstruction)
- **D1 migration** — if single-file model hits limits, same API contract on SQLite
- **MCP server** — expose board as MCP tools for agents with native MCP support
- **Story deletion + archival** — move done stories to `archive.json` after retention period

## References & Research

### Internal References

- Architecture spec: user-provided `swarm-board-spec.md`
- Stack guide: user-provided `swarm-board-stack.md`
- CLAUDE.md: `/Users/andrewbierman/Code/swarmboard/CLAUDE.md` — Bun mandated for all tooling

### External References

- [Elysia CF Worker Adapter docs](https://elysiajs.com/integrations/cloudflare-worker.html)
- [R2 API — conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Eden Treaty docs](https://elysiajs.com/eden/treaty/overview.html)
- [citty — unjs CLI framework](https://github.com/unjs/citty)
- [TypeBox — JSON Schema Type Builder](https://github.com/sinclairlabs/typebox)
- [Biome — linter/formatter](https://biomejs.dev/)

### Key Constraints from CLAUDE.md

- Bun for all tooling (package manager, test runner, bundler, script runner)
- No Express, no Vite, no npm/pnpm/yarn
- `Bun.serve()` for local dev, but CF Worker uses `workerd` runtime (not Bun APIs)
- Gitmoji commit prefixes required
