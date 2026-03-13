# PackRat API

The PackRat API is a [Hono.js](https://hono.dev) application running on [Cloudflare Workers](https://workers.cloudflare.com).

## Tech Stack

- **[Hono.js](https://hono.dev)** — fast, lightweight web framework with OpenAPI support
- **[Cloudflare Workers](https://workers.cloudflare.com)** — serverless edge runtime via Wrangler
- **[Drizzle ORM](https://orm.drizzle.team)** — type-safe SQL query builder
- **[PostgreSQL on Neon](https://neon.tech)** — serverless PostgreSQL
- **[Vercel AI SDK](https://sdk.vercel.ai)** — AI integrations (OpenAI, Perplexity)

## Getting Started

Install dependencies from the monorepo root:

```sh
bun install
```

Start the development server (runs on `http://localhost:8787`):

```sh
bun api
# or from this directory:
bun run dev
```

## Database

Migrations are managed with Drizzle Kit:

```sh
bun run db:generate   # generate a new migration from schema changes
bun run db:migrate    # apply pending migrations
bun run db:studio     # open Drizzle Studio in the browser
```

Schema is defined in `src/db/schema.ts`.

## Environment Variables

Copy `.env.example` from the monorepo root and fill in:

| Variable | Description |
|----------|-------------|
| `NEON_DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT access tokens |
| `OPENAI_API_KEY` | OpenAI API key |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

Wrangler reads variables from `.dev.vars` during local development. This file is generated automatically when you run `bun install` from the monorepo root. Re-run `bun install` whenever you change variables in `.env.local` to regenerate `.dev.vars`.

## Running Tests

```sh
bun test
```

Tests run sequentially (configured in `vitest.config.ts`) to avoid database conflicts.

## Adding Routes

Routes follow the OpenAPI pattern using `OpenAPIHono` and `createRoute`:

```typescript
// src/routes/{feature}/{routeName}.ts
import { createRoute, z } from '@hono/zod-openapi';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const myRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Feature'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: ResponseSchema } },
    },
  },
});

export const handler: RouteHandler<typeof myRoute> = async (c) => {
  // handler logic
};
```

Register new route groups in `src/routes/index.ts`.
