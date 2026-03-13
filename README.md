# PackRat 🎒

PackRat is the ultimate adventure planner for outdoor enthusiasts. Plan and organize your trips, manage gear, track trail conditions, and get AI-powered recommendations — all from one cross-platform app.

> [!NOTE]
> This project is currently in alpha. Please report any issues or bugs you encounter.

**Build & CI:**
![Biome Check](https://github.com/PackRat-AI/PackRat/actions/workflows/biome.yml/badge.svg)
![Check Types](https://github.com/PackRat-AI/PackRat/actions/workflows/check-types.yml/badge.svg)
![API Tests](https://github.com/PackRat-AI/PackRat/actions/workflows/api-tests.yml/badge.svg)
![Database Migrations](https://github.com/PackRat-AI/PackRat/actions/workflows/migrations.yml/badge.svg)

**Repository Info:**
![GitHub tag](https://img.shields.io/github/tag/PackRat-AI/PackRat?include_prereleases=&sort=semver&color=blue)
![License](https://img.shields.io/badge/License-GNU-blue)
![issues - PackRat](https://img.shields.io/github/issues/PackRat-AI/PackRat)

<div align="center">

[![View Beta Site](https://img.shields.io/badge/View%20Beta%20Site-%20-brightgreen)](https://packrat.world)

</div>

## Table of Contents

- [Overview](#overview-)
- [Features](#features-)
- [Technologies Used](#technologies-used-)
- [Folder Layout](#-folder-layout)
- [Adding Dependencies](#-add-new-dependencies)
- [Local Installation](#local-installation-)
  - [Prerequisites](#prerequisites)
  - [GitHub Packages Authentication](#github-packages-authentication)
  - [Environment Setup](#environment-setup)
  - [Git Hooks](#git-hooks-setup)
  - [Running the Apps](#installation--development)
  - [Debugging](#debugging-)
  - [Code Quality](#code-quality)
  - [Testing](#testing-)
- [API Architecture](#api-architecture)
- [Contributing](#contributing-)
- [License](#license-)

## Overview 🌐

With **PackRat**, you can:

- **Plan trips** — Create and manage outdoor adventures with dates, locations, and gear.
- **Manage packs** — Build packing lists, score them for completeness, and share them publicly or keep them private.
- **Browse the gear catalog** — Search a curated catalog of outdoor gear and add items directly to your packs.
- **Pack templates** — Save and reuse pack configurations for common trip types.
- **AI assistant** — Chat with an AI guide for trip suggestions, gear advice, and more.
- **Weather forecasts** — Get up-to-date weather for your trip location.
- **Trail conditions** — Report and browse real-time trail condition updates from the community.
- **Season suggestions** — Receive gear and activity recommendations based on your trip's location and season.
- **Weight analysis** — Analyze your pack weight breakdown by category.

## Features 🚀

| Feature | Status |
|---------|--------|
| Trip creation and management | ✅ |
| Pack management (items, weight, scoring) | ✅ |
| Gear catalog | ✅ |
| Pack templates | ✅ |
| AI chat assistant | ✅ |
| Weather forecasts | ✅ |
| Trail conditions reporting | ✅ |
| Season suggestions | ✅ |
| Weight analysis | ✅ |
| Pack sharing (public/private) | ✅ |
| Shopping list | ⚙️ Beta |
| Pack insights | ⚙️ Beta |
| Email / password authentication | ✅ |
| Google OAuth | ✅ |
| Apple Sign-In | ✅ |

## Technologies Used 💻

PackRat is built on a modern, fully TypeScript stack:

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo (Expo Router) |
| Web | Next.js 15 (landing page and guides site) |
| API | Hono.js on Cloudflare Workers |
| Database | PostgreSQL via Neon + Drizzle ORM |
| State management | Jotai + TanStack Query |
| AI | Vercel AI SDK, OpenAI, Perplexity |
| Storage | Cloudflare R2 |
| Styling | Tailwind CSS + NativeWind |
| Package manager | Bun (monorepo workspaces) |
| Linting / formatting | Biome |
| Type safety | TypeScript throughout |

## 🗂 Folder Layout

```
apps/
  expo/           React Native mobile app (Expo Router, NativeWind)
    app/          File-based routes and layouts
    features/     Feature modules (ai, auth, packs, trips, catalog, …)
    components/   Shared UI components
    atoms/        Jotai atoms for global state
    lib/          Utilities, API client, i18n, hooks
    assets/       Images, fonts, and other static assets
  landing/        Marketing website (Next.js 15)
  guides/         Outdoor guides content site (Next.js 15, MDX)

packages/
  api/            Hono.js API server on Cloudflare Workers
    src/          Routes, middleware, and services
    drizzle/      Database schema and migrations
    test/         API integration tests
  ui/             Shared UI component library (private GitHub package)
```

## 🆕 Add New Dependencies

### Pure JS dependencies

For libraries that work in any JavaScript environment:

```sh
# Install at the root to share across all apps
bun add lodash

# Or install in a specific package
cd packages/api && bun add dayjs
```

### Native dependencies (React Native)

For modules that require native code (Android/iOS):

```sh
cd apps/expo
bun add react-native-reanimated

# Rebuild after adding native dependencies
bun --cwd apps/expo run expo prebuild --clean
```

### Mobile app dependencies

```sh
cd apps/expo
bun add <package>
```

### API dependencies

```sh
cd packages/api
bun add <package>
```

### Web app dependencies

```sh
cd apps/landing  # or apps/guides
bun add <package>
```

## Dependency Management

Use [Manypkg](https://github.com/Thinkmill/manypkg) to keep dependency versions consistent across the monorepo:

```sh
bun check:deps   # find mismatches
bun fix:deps     # auto-fix mismatches
```

## Local Installation 📲

### Prerequisites

- [Bun](https://bun.sh) — primary package manager and runtime
- [Node.js](https://nodejs.org/) — required by some tooling
- [Expo CLI](https://docs.expo.io/workflow/expo-cli/) — for mobile development
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — for API development and deployment
- [GitHub CLI](https://cli.github.com/) — for authenticating with GitHub Packages

### GitHub Packages Authentication

PackRat uses a private package (`@packrat-ai/nativewindui`) from GitHub Package Registry. You must authenticate before installing dependencies.

#### Local Development

1. Install the GitHub CLI:

   ```bash
   # macOS
   brew install gh

   # Windows
   winget install --id GitHub.cli

   # Linux — see https://github.com/cli/cli#installation
   ```

2. Log in and add the `read:packages` scope:

   ```bash
   gh auth login
   gh auth refresh -h github.com -s read:packages
   ```

3. Install dependencies (authentication is handled automatically):

   ```bash
   bun install
   ```

   > The `preinstall` script maps your GitHub CLI token to `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN`, which `bunfig.toml` uses for package authentication.

#### CI / CD

1. Create a Personal Access Token (PAT) with the `read:packages` scope.
2. Add it as a repository secret named `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN`.
3. Pass it in your workflow:

   ```yaml
   - name: Install dependencies
     env:
       PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN: ${{ secrets.PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN }}
     run: bun install
   ```

   > The default `GITHUB_TOKEN` cannot access packages from other repositories; a custom PAT is required.

### Environment Setup

1. Clone the repository:

   ```bash
   # HTTPS
   git clone https://github.com/PackRat-AI/PackRat.git

   # SSH
   git clone git@github.com:PackRat-AI/PackRat.git

   cd PackRat
   ```

2. Copy the example environment file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   Key variables to configure:

   | Variable | Description |
   |----------|-------------|
   | `NEON_DATABASE_URL` | Neon PostgreSQL connection string |
   | `JWT_SECRET` | Secret for signing JWT tokens |
   | `OPENAI_API_KEY` | OpenAI API key for AI features |
   | `EXPO_PUBLIC_API_URL` | API base URL (default: `http://localhost:8787`) |
   | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client ID |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for R2 storage |

   See `.env.example` for the full list of required variables.

   > Variables prefixed with `EXPO_PUBLIC_` are bundled into the mobile app. Never put secrets in these variables.

3. Install dependencies:

   ```bash
   bun install
   ```

   A `.dev.vars` file for Wrangler is generated automatically. Re-run `bun install` whenever environment variables change.

### Git Hooks Setup

PackRat uses [Lefthook](https://github.com/evilmartians/lefthook) for git hooks. Hooks are installed automatically by `bun install`.

- **Pre-commit hook**: runs `bun check` (Biome lint) on staged files before every commit.

To bypass hooks temporarily:

```bash
git commit --no-verify
```

### Installation & Development

#### Install dependencies

```bash
bun install
```

#### Running the applications

**API Server** (runs on `http://localhost:8787`):

```bash
bun api
```

**Mobile App (Expo)**:

```bash
bun expo          # start Expo dev server
bun android       # run on Android device/simulator
bun ios           # run on iOS device/simulator
```

**Landing Page** (runs on `http://localhost:3000`):

```bash
cd apps/landing && bun dev
```

**Guides Site** (runs on `http://localhost:3001`):

```bash
cd apps/guides && bun dev
```

#### Typical development workflow

```bash
# Terminal 1: start the API
bun api

# Terminal 2: start the mobile app
bun expo
```

### Debugging 🐛

**Expo / mobile issues:**

```bash
bun --cwd apps/expo run expo-doctor    # check Expo setup
bun --cwd apps/expo run expo install --fix   # fix dependency versions
bun --cwd apps/expo run expo prebuild --clean  # clean native build
bun expo --clear                        # clear Metro cache
```

**Dependency issues:**

```bash
bun check:deps   # find monorepo dependency mismatches
bun fix:deps     # auto-fix mismatches
bun clean && bun install  # full clean reinstall
```

**API / Cloudflare issues:**

- Verify `packages/api/wrangler.jsonc` is configured correctly.
- Ensure all Cloudflare environment variables are set in `.env.local`.
- Run `bun api` to start the local Wrangler dev server.

### Code Quality

```bash
bun format        # auto-format all files (Biome)
bun lint          # lint and auto-fix issues (Biome)
bun check-types   # TypeScript type checking (tsc)
bun check:deps    # check monorepo dependency consistency
```

All formatting and linting is handled by [Biome](https://biomejs.dev). See `biome.json` for the project configuration.

### Testing 🧪

**API unit tests:**

```bash
cd packages/api && bun test
# or from the root:
bun test:api:unit
```

**Expo unit tests:**

```bash
bun test:expo
```

Tests run sequentially to avoid database conflicts. Ensure your environment variables are configured before running API tests.

## API Architecture

The PackRat API is built on:

- **[Hono.js](https://hono.dev)** — fast, lightweight web framework with OpenAPI support
- **[Cloudflare Workers](https://workers.cloudflare.com)** — serverless edge runtime
- **[Drizzle ORM](https://orm.drizzle.team)** — type-safe SQL query builder
- **[PostgreSQL on Neon](https://neon.tech)** — serverless PostgreSQL database
- **[OpenAI / Vercel AI SDK](https://sdk.vercel.ai)** — AI-powered features

All routes use `OpenAPIHono` with `createRoute` for fully typed, self-documenting endpoints. Authentication is handled by JWT bearer tokens or API keys via `authMiddleware`.

See `packages/api/README.md` for setup and development details.

## Contributing 🤝

> [!TIP]
> We have an active community of contributors. Open an issue or pull request to get started!

1. Fork and clone the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Make your changes and commit them.
4. Push to your fork and open a pull request.

Please ensure your changes pass linting (`bun lint`) and type checking (`bun check-types`) before opening a PR.

## 👏 Special Thanks

- [React Native Developers](https://twitter.com/reactnative)
- [OpenStreetMap Developers](https://www.openstreetmap.org/)
- [RN MapBox Developers](https://github.com/rnmapbox/maps)
- [Cloudflare Developers](https://twitter.com/CloudflareDev)
- [Yusuke Wada](https://twitter.com/yusukebe) — Creator of Hono.js
- [Tanner Linsley](https://twitter.com/tannerlinsley) — Creator of TanStack
- [Expo Developers](https://twitter.com/expo)

## License 📝

PackRat is licensed under the [GNU General Public License v3.0](LICENSE).
