---
title: Better Auth CLI Requires Static Export — Add auth.config.ts for Worker Projects
date: 2026-05-02
category: docs/solutions/developer-experience
module: Authentication
problem_type: developer_experience
component: authentication
severity: medium
applies_when:
  - Using Better Auth in a Cloudflare Workers project
  - Auth instance is created via a factory function that accepts a runtime env object
  - Running bunx auth generate or bunx auth migrate to manage schema
tags:
  - better-auth
  - cloudflare-workers
  - cli
  - schema-generation
  - factory-pattern
  - auth-config
---

# Better Auth CLI Requires Static Export — Add auth.config.ts for Worker Projects

## Context

The Better Auth CLI (`bunx auth@latest generate`, `bunx auth migrate`) needs to import your auth config at parse time to read the schema. In a standard Node.js app, `auth.ts` exports a static `betterAuth({...})` instance — the CLI finds it immediately.

In a Cloudflare Workers project, the auth instance is typically created per-request via a factory function that receives the live `env` object (KV bindings, secrets, DB URL, etc.). This makes the instance impossible for the CLI to construct:

```
[#better-auth]: Couldn't read your auth config.
[#better-auth]: Make sure to default export your auth instance or to export
                as a variable named auth.
```

The factory pattern is correct for Workers — you cannot have a static singleton with live bindings. The CLI just needs a parallel static entry point.

## Guidance

Create a dedicated `src/auth/auth.config.ts` file that exports a static `auth` variable with stub env values. Point the CLI at it with `--config`.

**The stub file mirrors the real config's schema exactly** (same plugins, same `additionalFields`, same table mappings) but uses hardcoded placeholder strings in place of secrets and URLs. No real connections are made during schema generation.

```ts
// src/auth/auth.config.ts
// Static auth instance for the Better Auth CLI (bunx auth generate --config src/auth/auth.config.ts).
// The runtime instance in index.ts requires a live Cloudflare env object;
// the CLI cannot call that factory, so this file provides stub values.

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { neon } from '@neondatabase/serverless';
import * as schema from '@packrat/api/db/schema';
import { betterAuth } from 'better-auth';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle(neon('postgresql://stub:stub@stub/stub'), { schema });

export const auth = betterAuth({
  baseURL: 'http://localhost:8787',
  secret: 'cli-stub-secret',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'USER' },
      firstName: { type: 'string', fieldName: 'first_name' },
      lastName: { type: 'string', fieldName: 'last_name' },
      avatarUrl: { type: 'string', fieldName: 'avatar_url' },
      passwordHash: { type: 'string', fieldName: 'password_hash' },
    },
  },
  emailAndPassword: { enabled: true },
  socialProviders: { google: { clientId: 'stub', clientSecret: 'stub' } },
  plugins: [bearer(), jwt(), admin()],
});
```

Run the CLI from `packages/api/`:

```bash
bunx auth@latest generate --config src/auth/auth.config.ts
```

## Why This Matters

Without this file the CLI exits immediately with the error above and no migration SQL is produced. The `--config` flag is the official escape hatch Better Auth provides for non-standard project layouts — using it keeps the runtime factory pattern intact while unblocking schema generation.

The stub DB URL (`postgresql://stub:stub@stub/stub`) works because `neon()` returns a lazy query function and `drizzle()` just wraps it — neither makes a network call at import time. The CLI only inspects the JS object graph, not the database.

## When to Apply

- Any time you need to run `bunx auth generate`, `bunx auth migrate`, or `bunx auth schema` against a Workers-based Better Auth project
- When onboarding a new developer who needs to regenerate the schema locally
- After adding new plugins or `additionalFields` to `index.ts` — update `auth.config.ts` to match, then re-run the CLI

## Examples

**Before** — running the CLI against the Workers factory file:

```bash
cd packages/api
bunx auth@latest generate
# [#better-auth]: Couldn't read your auth config.
```

**After** — running the CLI against the static stub file:

```bash
cd packages/api
bunx auth@latest generate --config src/auth/auth.config.ts
# ✓ Schema generated
```

**Keeping the two files in sync**: `auth.config.ts` must always mirror the schema-affecting parts of `index.ts` — `database` table mappings, `user.additionalFields`, and `plugins`. The stub file does not need to replicate operational concerns (rate limiting, secondary storage, Apple client-secret generation).

## Related

- [packages/api/src/auth/index.ts](packages/api/src/auth/index.ts) — runtime per-request factory
- [packages/api/src/auth/auth.config.ts](packages/api/src/auth/auth.config.ts) — static CLI stub
