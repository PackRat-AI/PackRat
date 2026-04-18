# PackRat Monorepo

Outdoor adventure planning platform — helps users plan trips, manage packing lists, discover destinations, and get weather/activity suggestions.

**Live**: https://packrat.world (alpha)

## Architecture

Bun workspace monorepo with three apps and two packages:

| Workspace | Stack | Purpose |
|---|---|---|
| `apps/expo` | React Native 0.81 / Expo 54 / Expo Router 6 | Mobile app (iOS + Android) |
| `apps/guides` | Next.js 15 / React 19 / Radix UI / Shadcn | Content/guides site |
| `apps/landing` | Next.js 15 / React 19 / Framer Motion | Marketing site |
| `packages/api` | Hono 4 on Cloudflare Workers / Drizzle ORM / Neon PostgreSQL | Backend API |
| `packages/ui` | Re-exports from `@packrat-ai/nativewindui` | Shared UI components |

### Infrastructure

- **Compute**: Cloudflare Workers (API), Durable Objects (containers)
- **Database**: Neon PostgreSQL with Drizzle ORM, pgvector (1536-dim embeddings)
- **Storage**: 3 R2 buckets — `packrat-bucket`, `packrat-scrapy-bucket`, `packrat-guides`
- **Queues**: `packrat-etl-queue` (serial), `packrat-embeddings-queue` (batch 100)
- **AI**: Vercel AI SDK (OpenAI, Google, Perplexity, Workers AI), on-device llama.rn
- **Monitoring**: Sentry (mobile + API)
- **Mobile CI/CD**: EAS Build (dev, preview, e2e, production profiles)

## Commands

```bash
# Dev
bun expo              # Start Expo dev server
bun ios               # iOS simulator
bun android           # Android emulator
bun api               # API dev server (wrangler)
cd apps/guides && bun dev   # Guides dev server
cd apps/landing && bun dev  # Landing dev server

# Quality
bun lint              # Biome check --write (auto-fix)
bun format            # Biome format --write
bun check             # Biome check (no auto-fix, CI mode)
bun check-types       # tsc --noEmit (root — comprehensive, single pass)

# Testing
bun test              # turbo run test — all unit tests in parallel
bun test:api:unit     # API unit tests only (Vitest + Cloudflare pool)
bun test:expo         # Expo tests only (Vitest)

# Build
bun build             # turbo run build — all Next.js apps in dep order

# Dependencies
bun install           # Install all workspaces (takes 120s+, never cancel)
bun check:deps        # manypkg check for workspace version consistency
bun fix:deps          # manypkg auto-fix dependency issues

# Versioning
bun bump              # Bump monorepo version
```

## Turborepo

Task orchestration via `turbo.json`. Handles parallel execution and local caching — no remote cache configured.

**Defined tasks:** `build`, `check-types`, `test`, `test:unit:coverage`, `test:coverage`, `lint`, `dev`, `deploy`

**Dependency ordering** (`dependsOn: ["^<task>"]`): turbo runs a dependency's task before the dependent app's task, but only when both workspaces define that task. e.g. `turbo run check-types` orders `@packrat/web-ui` before the Next.js apps because both define `check-types`; `turbo run build` orders builds by dependency but skips packages without a `build` script.

**Filtering** — run tasks for a subset of packages:
```bash
bun turbo run test --filter=@packrat/api          # one package
bun turbo run test --filter=@packrat/api...       # package + its dependents
bun turbo run check-types --filter=...[HEAD^]     # packages changed in last commit
bun turbo run check-types --filter=...[origin/development...HEAD]  # PR-affected only
```

**What runs through turbo vs direct:**
- `expo start`, `eas build`, EAS submit — run directly (EAS handles its own orchestration)
- `wrangler dev` / `wrangler deploy` — run directly or via `turbo run deploy --filter=@packrat/api`
- Biome (`lint`, `format`, `check`) — root-level, run directly (single config, no per-package scripts)

## Code Style

Enforced by **Biome 2.0** via lefthook pre-commit hook:

- 2 spaces, 100 char line width, single quotes
- Alphabetical imports (Biome auto-sorts)
- No `any` — use proper TypeScript types or `unknown`
- Strict null checks enabled, no unchecked indexed access

## Conventions

### API (packages/api)

- Routes use `OpenAPIHono` with `createRoute` + Zod schemas for type-safe, documented endpoints
- Validation schemas live in `src/schemas/`
- Business logic goes in `src/services/`, not in route handlers
- Middleware in `src/middleware/`
- Soft deletes for all user content
- async/await everywhere (no raw promises)

### Mobile (apps/expo)

Feature module structure:
```
features/{name}/
├── components/    # UI components
├── hooks/         # React Query hooks
├── screens/       # Screen components
├── types.ts       # TypeScript interfaces
└── index.ts       # Public exports
```

- **Routing**: File-based via Expo Router in `app/(app)/`
- **Styling**: NativeWind (Tailwind for RN) with CSS variable-based color system, manual dark mode toggle
- **State**: Jotai for local state, TanStack React Query for server state, Legend State for reactive state
- **Forms**: TanStack React Form
- **Feature flags**: `apps/expo/config.ts` — `featureFlags` object, default new flags to `false`
- **Animations**: React Native Reanimated 4

### Web Apps (apps/guides, apps/landing)

- Radix UI + Shadcn components, Tailwind CSS
- TanStack React Query for data fetching
- Zod for form validation

## Private Package Auth

`@packrat-ai/nativewindui` is hosted on GitHub Packages. The `preinstall` script (`configure-deps.ts`) automatically pulls your token from the GitHub CLI:

```bash
# One-time setup
gh auth login
gh auth refresh -h github.com -s read:packages

# Then bun install works — the preinstall script runs `gh auth token` automatically
bun install
```

`bunfig.toml` references `$PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN`, which the preinstall script sets from `gh auth token` at install time.

For CI or environments without `gh` CLI (e.g. Claude Code web), set the env var directly:
```bash
PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN=<token from `gh auth token`>
```

If you get 401 errors during `bun install`, either `gh` isn't authenticated or the token is missing/expired.

## Path Aliases

Defined in root `tsconfig.json`:

- `@packrat/api/*` → `packages/api/src/*`
- `@packrat/ui/*` → `packages/ui/*`
- `expo-app/*` → `apps/expo/*`
- `guides-app/*` → `apps/guides/*`
- `landing-app/*` → `apps/landing/*`
- `nativewindui/*` → `apps/expo/components/ui/*`

## Database

- ORM: Drizzle (`packages/api/src/db/schema.ts`)
- Migrations: Drizzle Kit (`drizzle-kit`)
- Embeddings: pgvector with 1536 dimensions

## EAS Build Profiles

| Profile | Use | Distribution |
|---|---|---|
| `development` | Dev client | Internal |
| `preview` | QA testing | Internal (auto-increment) |
| `e2e` | Maestro E2E tests | iOS Simulator / Android APK |
| `production` | App Store / Play Store | Store (auto-increment) |

## Common Issues

- **401 on `bun install`**: Missing `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` — see Private Package Auth above
- **Next.js build failures**: `apps/guides` and `apps/landing` may fail without internet (fetches remote data)
- **Type errors after NativeWindUI update**: Check for renamed refs — v2.0.0 renamed `AlertRef` → `AlertMethods`, `LargeTitleSearchBarRef` → `LargeTitleSearchBarMethods`
- **Bun install hangs**: Normal — takes 120+ seconds. Never cancel mid-install.
