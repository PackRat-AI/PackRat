# Ephemeral dev environments

`bun devenv` gives each agent (or each of your branches) a private database and
API on one command, instead of clicking through the Neon console every time.

```bash
bun devenv up            # Neon branch off `development` + API on a free port
bun devenv down          # stop the API, delete the Neon branch
bun devenv list          # every live environment on this machine
bun devenv url           # DATABASE_URL + API URL for this environment
bun devenv prune         # clean up environments whose worktree is gone
```

## One-time setup

Add two values to the repo-root `.env.local`:

```
NEON_API_KEY=napi_...
NEON_PROJECT_ID=...
```

- **API key** — https://console.neon.tech/app/settings/api-keys
- **Project ID** — Neon console → Project settings → General

Both are read from the process environment first, so an agent can override
either per-invocation without touching the shared file.

## What `up` does

1. Creates a Neon branch named `devenv/<name>` off `development`. Neon branches
   are copy-on-write, so this takes seconds and costs no storage — the branch
   carries `development`'s seed data immediately.
2. Allocates a free port in 8788–8850, skipping ports already claimed by other
   environments on this machine.
3. Writes `packages/api/.dev.vars.devenv-<name>` — a copy of your `.dev.vars`
   with `NEON_DATABASE_URL` pointed at the new branch. Your base `.dev.vars` is
   never modified, so a plain `bun api` still works unchanged.
4. Runs `db:migrate` against the branch, applying only what your checkout adds
   on top of `development`.
5. Starts `wrangler dev` on the allocated port.

The default environment name is your current git branch, so two worktrees on
different branches get separate environments with nothing to name or configure.

## Parallel agents

State lives in `~/.packrat/devenv/`, outside any worktree, so every agent on the
machine sees the same registry. That is what makes port allocation collision-free
across worktrees and lets `bun devenv list` show the whole picture.

Point a client at an environment with:

```bash
export EXPO_PUBLIC_API_URL="$(bun devenv url --json | jq -r '"http://localhost:" + (.port|tostring)')"
```

## Cleaning up

`down` deletes the Neon branch; pass `--keep-branch` to keep the data and only
stop the API. If a worktree is deleted without a `down`, its Neon branch is
orphaned — `bun devenv prune` removes every environment whose worktree is gone.

## How environment variables reach a worktree

`.env.local` at the **main checkout** is the only place secrets live. Everything
else is generated from it.

`git worktree add` never copies `.env.local` — it is gitignored — so resolving it
relative to the current checkout leaves a new worktree with no environment at
all. `.github/scripts/env-source.ts` therefore resolves it via
`git rev-parse --git-common-dir`, which points at the main checkout from
anywhere inside any linked worktree:

1. A `.env.local` in the worktree itself wins, if you deliberately put one there.
2. Otherwise the main checkout's `.env.local` is used.

The postinstall shim (`.github/scripts/env.ts`) fans that one file out into
`packages/api/.dev.vars`, `apps/expo/.env.local`, and the Next apps. Adding a key
to the main checkout's `.env.local` therefore reaches every worktree — no copying.

### Fail-fast validation

`bun api` and `bun devenv up` run `.github/scripts/env-check.ts` first. It
regenerates the derived files from the resolved source, then validates
`.dev.vars` against the API's own Zod schema (`apiEnvSchema`) — the same schema
the Worker parses at boot, which is what distinguishes genuinely required keys
from optional ones. A missing key stops the boot and is named in the error.

### Placeholder guard

The generator refuses to run when the source `.env.local` still contains
`.env.example` placeholder values (`postgres://username:password@host…`).
Without that guard, running `bun install` against an unfilled `.env.local`
silently overwrites a working `.dev.vars` with placeholders.

## Client API URLs

The API URL cannot be a static value in the shared `.env.local`: every `devenv`
environment allocates its own port (8788+, so parallel agents do not collide),
and a fixed `EXPO_PUBLIC_API_URL=http://localhost:8787` points every worktree at
whichever agent happens to hold the default port.

`bun devenv up` therefore regenerates the client env files with
`DEVENV_API_URL` set to its own port. The shim overrides `PUBLIC_API_URL` and
`EXPO_PUBLIC_API_URL` for that generation only — the shared `.env.local` is
never written to, so environments cannot corrupt each other's source of truth.

`bun devenv url` prints the values a client needs:

```
NEON_DATABASE_URL=...
PUBLIC_API_URL=http://localhost:8791
EXPO_PUBLIC_API_URL=http://localhost:8791
NEXT_PUBLIC_API_URL=http://localhost:8791
```

### Apps that were missing from the fan-out

`apps/trails` and `apps/web` were never in the shim's app list, so they had no
generated `.env.local` at all. Both are now included.

### No production fallback

`apps/trails` previously defaulted `NEXT_PUBLIC_API_URL` to
`https://api.packratai.com`, so a local run with no env silently read and wrote
**production** data. It now defaults to the local API, which fails visibly when
nothing is running — the safe direction for a default.

## Notes from the first end-to-end run

- **Connection URIs.** Neon's branch-create response does not include
  `connection_uris` — that field is only returned by project create. The URI
  comes from `GET /projects/{id}/connection_uri`, which mints the role password
  (the roles list does not expose it).
- **Containers are off by default.** The `wrangler.jsonc` container binding makes
  `wrangler dev` require a running Docker daemon. `devenv` passes
  `--enable-containers=false`; set `DEVENV_CONTAINERS=1` when you actually need
  to exercise container routes.
- **Detached output goes to a log**, `~/.packrat/devenv/<name>.log`, not
  `/dev/null` — a backgrounded API that dies at startup would otherwise leave a
  record claiming `running` with nothing behind it.
- **Partial failures roll back.** If anything throws after the Neon branch is
  created but before the record is saved, the branch is deleted rather than
  stranded. `bun devenv prune` also sweeps any `devenv/` branch with no local
  record, which covers an interrupted run or a hand-deleted record.
- **`down` regenerates the client env**, so a torn-down environment stops
  leaving the worktree pointed at a dead port.
