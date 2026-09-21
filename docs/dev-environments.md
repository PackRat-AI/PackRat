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
