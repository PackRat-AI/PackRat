# PackRat Monorepo

Outdoor adventure planning platform — helps users plan trips, manage packing lists, discover destinations, and get weather/activity suggestions.

**Live**: https://packrat.world (alpha)

## Architecture

Bun workspace monorepo with three apps and two packages:

| Workspace | Stack | Purpose |
|---|---|---|
| `apps/expo` | React Native 0.83 / Expo 55 / Expo Router 55 | Mobile app (iOS + Android) |
| `apps/guides` | Next.js 15 / React 19 / Radix UI / Shadcn | Content/guides site |
| `apps/landing` | Next.js 15 / React 19 / Framer Motion | Marketing site |
| `packages/api` | Elysia on Cloudflare Workers / Drizzle ORM / Neon PostgreSQL | Backend API |
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
bun check-types       # tsc --noEmit at root (single pass over whole graph)
bun check-types:packages  # turbo run check-types (per-package, parallel)

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

**Type checking — two paths, both should pass:**
- `bun check-types` — root `tsc --noEmit` over the whole graph using the root `tsconfig.json`. Single pass, comprehensive, picks up every file matched by the root include globs.
- `bun check-types:packages` (alias for `turbo run check-types`) — runs each workspace's own `check-types` script in parallel. Each workspace uses its own `tsconfig.json` (which should extend `../../tsconfig.json`) so per-package strictness matches root. If one passes and the other doesn't, the per-package tsconfig has drifted — fix the tsconfig, not the code.

**Filtering** — run tasks for a subset of packages:
```bash
bun turbo run test --filter=@packrat/api          # one package
bun turbo run test --filter=@packrat/api...       # package + its dependents
bun turbo run check-types --filter=@packrat/api   # one package only
```

We intentionally do not use `--affected`. In this monorepo many things are tied together via shared types and runtime imports that turbo's dependency graph can't always see; running the full check is cheap with turbo's local cache and gives us a guarantee that affected analysis can't.

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

## Commit Conventions

Use **[gitmoji](https://gitmoji.dev/)** for commit messages. Format: `<emoji> <type>(<scope>): <description>` — the gitmoji replaces or augments the conventional-commit type prefix. Pick the emoji whose meaning best matches the change.

```
✨ feat(api): add weather forecast endpoint
🐛 fix(expo): correct pack template sort order
♻️  refactor(api): extract validation into shared module
📝 docs: document turborepo pipeline
🚀 chore(ci): cache turbo locally per workspace
✅ test(api): cover queue batching edge cases
🔧 chore(config): bump biome to 2.1
🎨 style: format with biome
⚡️ perf(expo): memoize pack template list
🔥 chore: remove deprecated weather util
🚨 fix(api): resolve biome warnings
🔒 fix(api): patch SSRF in external fetch
⬆️  chore(deps): bump next to 16.2.4
🚧 wip(expo): trail conditions submission
```

Common ones used in this repo:
- ✨ `:sparkles:` — new feature
- 🐛 `:bug:` — bug fix
- ♻️ `:recycle:` — refactor with no behavior change
- 📝 `:memo:` — docs
- 🚀 `:rocket:` — deploy / CI / build infra
- ✅ `:white_check_mark:` — tests
- 🔧 `:wrench:` — config files
- ⚡️ `:zap:` — perf
- 🔥 `:fire:` — remove code or files
- 🚨 `:rotating_light:` — fix linter/compiler warnings
- 🔒 `:lock:` — fix security issue
- ⬆️ `:arrow_up:` — upgrade dependency
- 🚧 `:construction:` — work in progress

Full reference at <https://gitmoji.dev/>. The Biome pre-commit hook does not enforce gitmoji — convention is honor-system, applied on every commit including dependabot and Claude-generated.

## Conventions

### API (packages/api)

- Routes are built with **Elysia** on Cloudflare Workers using `new Elysia({ prefix: '...' }).use(plugin)`
- OpenAPI docs generated by `@elysiajs/openapi`; typed client uses Eden Treaty (`@elysiajs/eden`)
- Validation schemas live in `src/schemas/`
- Business logic goes in `src/services/`, not in route handlers
- Middleware in `src/middleware/` — use the `authPlugin` macro (`isAuthenticated: true`) for protected routes
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

### Web Apps (apps/guides, apps/landing, apps/trails)

- Radix UI + Shadcn components, Tailwind CSS
- TanStack React Query for data fetching
- Zod for form validation

### Monitoring (Sentry)

All new code that performs async operations or calls external services must include Sentry instrumentation. Sentry is already initialised per-platform — you only need to import and call the helpers.

**Expo / React Native** — import from `@sentry/react-native`:

```ts
import * as Sentry from '@sentry/react-native';

// Before an async operation
Sentry.addBreadcrumb({ category: 'feature', message: 'Action started', level: 'info', data: { ... } });

// In every catch block — capture the original error, never a re-wrapped one
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'myFeature', action: 'doThing' },
    extra: { userId, relevantId },
  });
  throw error;
}
```

- **Never wrap the root error** in `new Error(...)` before passing to `captureException` — that loses the original stack and context.
- **Better Auth errors** (plain objects with `{ message, status, code }`) are not JS Errors. Use `toAuthError` from `expo-app/features/auth/lib/authErrors` to convert them into an `AuthClientError` that carries `status` and `code`. Capture and throw that — do not create a separate synthetic error for Sentry and another for throwing.
- Include `httpStatus` and `errorCode` in `extra` for any HTTP error so they're searchable in Sentry.

**API / Cloudflare Workers** — use helpers from `@packrat/api/utils/sentry`:

```ts
import { apiAddBreadcrumb, captureApiException } from '@packrat/api/utils/sentry';

// Breadcrumb before significant async steps
apiAddBreadcrumb({ category: 'feature', message: 'Fetching external data', level: 'info' });

// In every catch block
} catch (error) {
  captureApiException(error, {
    operation: 'featureName.action',
    userId,
    tags: { feature: 'myFeature' },
    extra: { relevantId },
  });
  throw error; // or return an error response
}
```

- Use `captureApiException` (not raw `captureException`) — it wraps the call with structured operation context and also logs to console for wrangler dev output.
- Every route `catch` block and service method that interacts with the DB or an external API must have a `captureApiException` call.

### API Client (`@packrat/api-client`)

Use `createApiClient` from `@packrat/api-client` for all PackRat API calls in web apps. **Never write manual fetch wrappers for PackRat API endpoints.**

```ts
// apps/<name>/lib/apiClient.ts
import { createApiClient } from '@packrat/api-client';
import { clearTokens, clearUser, getAccessToken, getRefreshToken, setTokens } from './auth';

export const apiClient = createApiClient({
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  auth: {
    getAccessToken,
    getRefreshToken,
    onAccessTokenRefreshed: (token) => { /* persist new access token */ },
    onRefreshTokenRefreshed: (token) => { /* persist new refresh token */ },
    onNeedsReauth: () => { clearTokens(); clearUser(); },
  },
});
```

- `baseUrl` should be the same origin when routing through a CF Worker proxy (so rate limiting applies); use `EXPO_PUBLIC_API_URL` for the Expo app
- `AuthHooks` wires your platform's token storage — the package is transport-only
- The client handles 401 → refresh → retry automatically; `onNeedsReauth` fires only when refresh itself fails
- Call via Treaty path syntax: `apiClient.auth.login.post(...)`, `apiClient.trails.search.get({ query: { q } })`
- Responses are `{ data, error, status }` — check `if (error || !data)` before using `data`

## Private Package Auth

`@packrat-ai/nativewindui` is hosted on GitHub Packages. `bunfig.toml` resolves the scope using `$PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN`. Bun auto-loads `.env.local` before running `install`, so the simplest setup is to put the token there alongside your other secrets.

### One-time GitHub CLI setup

```bash
gh auth login
gh auth refresh -h github.com -s read:packages   # write:packages also works
```

### Preferred: add the token to `.env.local`

Append to the repo-root `.env.local` (gitignored):

```bash
PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN=<token from `gh auth token`>
```

Then `bun install` just works — Bun picks it up automatically.

### Alternative: export in shell

Useful in ephemeral shells or when you don't keep a `.env.local`:

```bash
# Inline
export PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN=$(gh auth token)
bun install

# One-liner
PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN=$(gh auth token) bun install
```

The `preinstall` hook cannot inject env vars into the parent `bun install` process (Bun has already parsed `bunfig.toml`), so if neither `.env.local` nor a shell export has the token, install will 401.

### CI / environments without `gh`

Set the env var directly from secrets:

```bash
PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN=<personal access token with read:packages>
```

### Troubleshooting

- **401 on `@packrat-ai/nativewindui`**: Token is missing from both `.env.local` and your shell, or lacks `read:packages`. Check `.env.local` first.
- The `preinstall` hook (`bun run configure:deps`) only *validates* that the token is visible to the install process — it doesn't inject it.

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
