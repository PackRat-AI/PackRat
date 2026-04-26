# PackRat - Outdoor Adventure Planning Platform

PackRat is a modern full-stack application for outdoor enthusiasts to plan and organize their adventures. Built with React Native/Expo for mobile, Next.js for web, and Cloudflare Workers for API, all managed in a monorepo using Bun.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Architecture Overview

- **Package Manager**: Bun (primary) with workspaces monorepo
- **Mobile**: React Native with Expo (apps/expo)
- **Web**: Next.js 15+ with React 19 (apps/landing, apps/guides)
- **API**: Hono.js on Cloudflare Workers with Wrangler CLI (packages/api)
- **Database**: PostgreSQL via Neon with Drizzle ORM
- **Styling**: Tailwind CSS / NativeWind with custom `@packrat-ai/nativewindui` components
- **Code Quality**: Biome for formatting and linting
- **AI/ML**: Vercel AI SDK with OpenAI, Perplexity, and Workers AI providers; pgvector for embeddings

## Working Effectively

### Prerequisites and Installation

1. **Install Bun (Primary Package Manager)**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source "$HOME/.bun/env"
   ```

2. **Authenticate with GitHub for Private Packages**:
   ```bash
   gh auth login
   gh auth refresh -h github.com -s read:packages
   ```

3. **Install Dependencies** (requires GitHub auth for `@packrat-ai/nativewindui`):
   ```bash
   bun install
   ```
   - NEVER CANCEL: takes up to 60 seconds, set timeout to 120+ seconds
   - Without authentication, `bun install` will fail with 401 errors
   - Alternative: Set `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` environment variable

4. **Clean Install** (when needed):
   ```bash
   bun clean && bun install
   ```
   - `bun clean` removes `node_modules`, build artifacts (`.next`, `.expo`, `dist`, `.wrangler`, `.turbo`), and caches across all workspaces
   - NEVER CANCEL: takes up to 90 seconds, set timeout to 180+ seconds

### Build and Development Commands

#### **Format and Lint** (Fast Operations)
- **Format Code**: `bun format` -- takes <1 second, formats 600+ files
- **Lint Code**: `bun lint` -- takes ~1 second, may show warnings (auto-fix mode)
- **Lint CI Mode**: `bun check` -- Biome check with no auto-fix (use in CI)
- **Type Check**: `bun check-types` -- FAILS without dependencies installed (expected)

#### **Development Servers**
Run each application independently. NEVER CANCEL these commands:

**API Server (Hono + Cloudflare Workers)**:
```bash
bun api
```
- NEVER CANCEL: Takes ~10 seconds to start, set timeout to 60+ seconds
- Runs on `http://localhost:8787`
- May show network warnings (expected in restricted environments)
- API endpoints require authentication, returns `{"error":"Unauthorized"}` without auth

**Mobile App (Expo)**:
```bash
bun expo          # Start Expo development server
bun android       # Run on Android device/simulator
bun ios           # Run on iOS device/simulator
```
- NEVER CANCEL: Expo commands can take 2+ minutes, set timeout to 180+ seconds

**Landing Page (Next.js)**:
```bash
cd apps/landing && bun dev
```
- NEVER CANCEL: Takes ~1.4 seconds to start, set timeout to 30+ seconds
- Runs on `http://localhost:3000`

**Guides Site (Next.js)**:
```bash
cd apps/guides && bun dev
```
- NEVER CANCEL: Takes ~1.4 seconds to start, set timeout to 30+ seconds
- Runs on `http://localhost:3001` (if 3000 is taken)

#### **Testing**
- **API Unit Tests**: `bun test:api:unit` -- NEVER CANCEL: Takes ~5 seconds
- **Expo Tests**: `bun test:expo` -- runs Expo/React Native unit tests
- Tests run sequentially (`fileParallelism: false` in `packages/api/vitest.unit.config.ts`) to avoid database deadlocks
- Tests expect environment variables to be configured (see `.env.example`)

#### **Build Commands**
- **Guides Build**: `cd apps/guides && bun run build` -- set timeout to 300+ seconds
- **Landing Build**: `cd apps/landing && bun run build` -- set timeout to 300+ seconds
- Note: Builds may fail without internet access (Google Fonts dependency)

#### **Database Migrations**
```bash
cd packages/api && bun run db:generate   # Generate new migration
cd packages/api && bun run db:migrate    # Apply migrations
cd packages/api && bun run db:studio     # Open Drizzle Studio
```

#### **Dependency Management and Versioning**
```bash
bun check:deps   # Check workspace version consistency (manypkg)
bun fix:deps     # Auto-fix dependency version inconsistencies
bun bump         # Bump monorepo version
```

## Coding Conventions

### TypeScript & Code Style

- **Formatter**: Biome with 2-space indentation, 100-character line width, single quotes
- **Never use `any`** in TypeScript — use proper types or `unknown`
- **Zod schemas** for all API request/response validation
- Use `async/await` for all asynchronous operations
- Imports are auto-organized by Biome — don't manually sort them

### API Routes (packages/api)

New routes use `OpenAPIHono` with `createRoute` for type-safe, OpenAPI-documented endpoints:

```typescript
// packages/api/src/routes/{feature}/{routeName}.ts
import { createRoute, z } from '@hono/zod-openapi';
import type { RouteHandler } from '@packrat/api/types/routeHandler';

export const routeDefinition = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['FeatureName'],
  summary: 'Brief description',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Success response',
      content: { 'application/json': { schema: ResponseSchema } },
    },
  },
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  // handler logic
};
```

- New feature routes go in `packages/api/src/routes/{feature}/` with an `index.ts` aggregator
- Register new route groups in `packages/api/src/routes/index.ts` under `protectedRoutes`
- Use `authMiddleware` for protected routes; it supports both JWT bearer tokens and API keys

### Database (packages/api)

- **ORM**: Drizzle ORM — define schemas in `packages/api/src/db/schema.ts`
- **Soft deletes**: Use a `deleted: boolean().default(false)` column for user-generated content (packs, items, trips); account deletion is a hard delete (`db.delete(users)`)
- **Timestamps**: Add `createdAt` and `updatedAt` where needed for sync or auditing; short-lived records (e.g. `refreshTokens`, `oneTimePasswords`) only need `createdAt`
- **Vector embeddings**: Use 1536-dimension vectors with HNSW cosine-similarity indexes
- **Services pattern**: Complex DB logic goes in `packages/api/src/services/{feature}Service.ts`

```typescript
// Drizzle query example
const pack = await db.query.packs.findFirst({
  where: and(eq(packs.id, packId), eq(packs.deleted, false)),
  with: { items: { where: eq(packItems.deleted, false) } },
});
```

- After changing the schema, always run `bun run db:generate` to create a new migration

### Mobile App Features (apps/expo)

New features follow a module structure:

```
apps/expo/features/{featureName}/
├── components/    # UI components specific to this feature
├── hooks/         # Custom hooks (use React Query: useQuery, useMutation, useInfiniteQuery)
├── screens/       # Screen components
├── types.ts       # TypeScript interfaces
└── index.ts       # Public exports
```

- Add routes in `apps/expo/app/(app)/` using Expo Router file-based routing
- Add a feature flag in `apps/expo/config.ts` (`featureFlags.enableX: boolean`) to gate the feature
- Use `featureFlags.enableX` to conditionally show tabs in `_layout.tsx` and tiles on the home screen
- Use `@packrat-ai/nativewindui` components for consistent cross-platform UI

### Feature Flags

Feature flags are defined in `apps/expo/config.ts`:

```typescript
export const featureFlags = {
  enableOAuth: true,
  enableTrips: true,
  enablePackTemplates: true,
  enablePackInsights: false,    // disabled features default to false
  enableShoppingList: false,
  enableSharedPacks: false,
};
```

Always add new features behind a flag and default to `false` until the feature is production-ready.

### Web Apps (apps/landing, apps/guides)

- Use `<Button asChild>` with a `<Link>` child for button-styled links (do NOT wrap `<Button>` inside `<Link>`)
- Tailwind CSS for all styling — no inline styles
- Radix UI for accessible components

## Repository Structure

```
apps/
  expo/           React Native mobile app (Expo Router, NativeWind)
  landing/        Marketing site (Next.js 15)
  guides/         Outdoor guides content site (Next.js 15, MDX)
packages/
  api/            Cloudflare Workers API (Hono, Drizzle, OpenAPI)
  ui/             Shared UI components (requires GitHub auth)
.github/
  workflows/      CI/CD pipelines
  scripts/        Build and configuration scripts
  copilot-setup-steps.yml   Copilot coding agent environment setup
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/api/src/db/schema.ts` | Drizzle database schema (all tables) |
| `packages/api/src/routes/index.ts` | API route registration |
| `packages/api/wrangler.jsonc` | Cloudflare Workers configuration |
| `apps/expo/config.ts` | Feature flags and app configuration |
| `apps/expo/app.config.js` | Expo configuration |
| `biome.json` | Formatting and linting rules |
| `lefthook.yml` | Git hooks (auto-runs `bun format` on pre-push) |

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `biome.yml` | Pull Requests | Code formatting and linting |
| `check-types.yml` | Pull Requests | TypeScript type checking |
| `api-tests.yml` | Push to main/dev + PRs | Vitest API tests |
| `migrations.yml` | Push to main/dev | Database schema migrations |
| `sync-guides-r2.yml` | Push to dev + Manual | Sync guides content to Cloudflare R2 |

**Required CI Secrets:**
- `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` - GitHub PAT with `read:packages` scope
- Cloudflare API tokens for deployment
- Database URL and API keys (see `.env.example`)

## Validation

Always validate changes manually before committing:

### API Validation
```bash
bun api
curl -sf http://localhost:8787/ | grep -q "PackRat API" && echo "OK"   # public liveness check
curl http://localhost:8787/api/packs   # expect 401 Unauthorized (protected route)
```

### Code Quality
```bash
bun format && bun lint   # must complete without errors
```

### Web Apps
```bash
cd apps/guides && bun dev   # curl http://localhost:3001
cd apps/landing && bun dev  # curl http://localhost:3000
```

## Common Issues and Solutions

| Problem | Solution |
|---------|---------|
| `bun install` fails with 401 | Run `gh auth login && gh auth refresh -h github.com -s read:packages` |
| Next.js build fails (Google Fonts) | Expected in restricted networks; dev servers work fine |
| `bun check-types` fails with module not found | Install dependencies first with `bun install` |
| Port conflicts | Landing page: 3000, Guides: 3001, API: 8787 |
| API tests fail | Requires environment variables and Cloudflare Workers config |
| API server shows network warnings | Normal in restricted environments; ignore |

## Time Expectations

**NEVER CANCEL long-running operations. Always set appropriate timeouts:**

| Operation | Expected Time | Timeout |
|-----------|--------------|---------|
| `bun install` | ~1 minute | 120+ seconds |
| `bun format` | <1 second | — |
| `bun lint` | ~1 second | — |
| `bun check-types` | ~17 seconds | 60 seconds |
| API server startup | ~10 seconds | 60 seconds |
| Expo startup | ~10 seconds | 180+ seconds |
| Next.js dev server | ~5 seconds | 30 seconds |
| `bun test:api:unit` | ~5 seconds | 60 seconds |
| `bun test:expo` | ~5 seconds | 60 seconds |
| Mobile app build (local) | 10-15 minutes | 30+ minutes |
| Mobile app build (EAS) | 15-30 minutes | 60+ minutes |
