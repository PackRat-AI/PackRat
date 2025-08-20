# PackRat - Outdoor Adventure Planning Platform

PackRat is a modern full-stack application for outdoor enthusiasts to plan and organize their adventures. Built with React Native/Expo for mobile, Next.js for web, and Cloudflare Workers for API, all managed in a monorepo using Bun.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Prerequisites and Installation

Install required tools:
- Install Bun: `curl -fsSL https://bun.sh/install | bash && source ~/.bashrc`
- Install Node.js (required for some tooling): Use Node.js 20+ 
- Install GitHub CLI: `sudo apt install gh` (Ubuntu/Debian) or follow [GitHub CLI installation](https://cli.github.com)
- Install Wrangler CLI: `bun install -g wrangler`

### Initial Setup

**CRITICAL:** GitHub authentication is required for private packages:
1. Authenticate with GitHub CLI: `gh auth login`
2. Add packages scope: `gh auth refresh -h github.com -s read:packages`
3. Install dependencies: `bun install` (takes ~1 minute)

**Alternative:** Set environment variable `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` with a Personal Access Token that has `read:packages` scope.

### Build and Development Commands

**Install Dependencies:**
```bash
bun install  # Takes ~1 minute. NEVER CANCEL.
```

**Code Quality:**
```bash
bun format   # Format code with Biome (takes ~1 second)
bun lint     # Lint code with Biome (takes ~1 second)  
bun check-types  # TypeScript checking - WILL FAIL without GitHub auth (takes ~17 seconds)
```

**Application Development:**

**API Server (Cloudflare Workers):**
```bash
bun api  # Start API development server on http://localhost:8787
# Takes ~10 seconds to start. NEVER CANCEL.
# Shows Cloudflare Workers dev environment with local R2, queues, and AI bindings
# Will show network warnings - these are normal in development
```

**Mobile App (Expo/React Native):**
```bash
bun expo     # Start Expo development server (Metro bundler)
bun android  # Run on Android device/emulator
bun ios      # Run on iOS device/simulator
# Expo starts in ~10 seconds. NEVER CANCEL.
# Runs on http://localhost:8081
```

**Landing Page (Next.js):**
```bash
cd apps/landing
bun dev  # Start Next.js dev server on http://localhost:3000
# Takes ~5 seconds to start
```

**Guides Site (Next.js):**
```bash
cd apps/guides
bun dev  # Start Next.js dev server on http://localhost:3000  
# Takes ~5 seconds to start
# Note: Content is pre-built during installation
```

### Testing

**API Tests:**
```bash
cd packages/api
bun test  # Run Vitest tests with Cloudflare Workers environment
# Currently requires GitHub authentication to pass
# Takes ~5 seconds when configured correctly
```

**Note:** API tests use Cloudflare Workers vitest pool and require proper authentication setup to pass.

### Building for Production

**API Deployment:**
```bash
cd packages/api
wrangler deploy  # Deploy to Cloudflare Workers
```

**Next.js Applications:**
```bash
cd apps/landing && bun build  # Build landing page
cd apps/guides && bun build   # Build guides site (includes content generation)
# Note: Builds may fail in environments without internet access due to Google Fonts
```

**Mobile App Builds:**
```bash
cd apps/expo
# EAS Build (requires Expo account)
bun build:preview        # Preview build locally
bun build:production     # Production build locally
bun build:preview:eas    # Preview build on EAS
bun build:production:eas # Production build on EAS
# Local builds take 10-15 minutes. NEVER CANCEL. Set timeout to 30+ minutes.
```

## Validation Scenarios

**Always test these scenarios after making changes:**

1. **API Validation:**
   - Start API server: `bun api`
   - Test health endpoint: `curl http://localhost:8787/api/health`
   - Expected: `{"error":"Unauthorized"}` (auth required)

2. **Mobile App Validation:**
   - Start Expo: `bun expo`
   - Check Metro bundler is running on http://localhost:8081
   - Can connect with Expo Go app or simulator

3. **Web Applications:**
   - Start dev servers for landing/guides: `cd apps/landing && bun dev`
   - Access http://localhost:3000
   - Check for no build errors in console

4. **Code Quality Validation:**
   - Run `bun format && bun lint` - should complete without errors
   - Pre-push hooks automatically run formatting checks

## Repository Structure

### Key Directories

**Applications (`apps/`):**
- `expo/` - React Native mobile app with Expo
- `landing/` - Marketing/landing website (Next.js)  
- `guides/` - Content site with generated outdoor guides (Next.js)

**Packages (`packages/`):**
- `api/` - Cloudflare Workers API with Hono framework
- `ui/` - Shared UI components (requires GitHub auth)

**Configuration Files:**
- `biome.json` - Code formatting and linting config
- `lefthook.yml` - Git hooks configuration  
- `bunfig.toml` - Bun package manager configuration
- `package.json` - Monorepo scripts and dependencies

### Important Files to Check

**When modifying API:**
- Always check `packages/api/wrangler.jsonc` for Cloudflare configuration
- Update `packages/api/src/routes/` for new endpoints
- Check `packages/api/drizzle/` for database schema changes

**When modifying mobile app:**
- Check `apps/expo/app.config.js` for Expo configuration
- Update `apps/expo/app/` for screen changes (uses Expo Router)
- Check `apps/expo/components/` for reusable components

**When adding dependencies:**
- Run `bun fix:deps` to check for version mismatches
- Update relevant package.json files
- Private packages require GitHub authentication

## Common Issues and Solutions

**GitHub Authentication Failures:**
- Ensure `gh auth login` and `gh auth refresh -h github.com -s read:packages` are completed
- Alternative: Set `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` environment variable
- Error: `401` from npm.pkg.github.com means authentication failed

**Build Failures:**
- Next.js builds may fail without internet access (Google Fonts dependency)
- Type checking fails without private package authentication
- Use `bun clean && bun install` to reset dependencies

**Development Server Issues:**
- API server shows network warnings - these are normal
- Expo runs in CI mode in some environments - reloads may be disabled
- Multiple apps running simultaneously may cause port conflicts

**Testing Issues:**
- API tests require GitHub authentication and proper Cloudflare configuration
- Tests use `@cloudflare/vitest-pool-workers` for Workers environment simulation
- Mock external services for unit tests

## Time Expectations

**NEVER CANCEL these operations - they are expected to take time:**

- Initial `bun install`: ~1 minute
- API server startup: ~10 seconds  
- Expo startup: ~10 seconds
- Next.js dev server startup: ~5 seconds
- Type checking: ~17 seconds
- Code formatting: ~1 second
- Code linting: ~1 second
- API tests: ~5 seconds (when properly configured)
- Mobile app builds (local): 10-15 minutes - Set timeout to 30+ minutes
- Mobile app builds (EAS): 15-30 minutes - Set timeout to 60+ minutes

## CI/CD Integration

**Required Environment Variables for CI:**
- `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` - GitHub Personal Access Token with `read:packages` scope
- Cloudflare API tokens for API deployment
- Expo credentials for mobile builds

**GitHub Actions:**
- `.github/workflows/biome.yml` - Code quality checks
- See workflow files for complete CI setup

## Development Workflow

**Typical development session:**
```bash
# 1. Setup (one-time)
gh auth login
gh auth refresh -h github.com -s read:packages
bun install

# 2. Start development servers (separate terminals)
bun api          # Terminal 1: API server
bun expo         # Terminal 2: Mobile app  
cd apps/guides && bun dev  # Terminal 3: Web app (optional)

# 3. Make changes and validate
bun format       # Format code
bun lint         # Check linting
# Test functionality in Expo Go app or web browser

# 4. Before committing
bun format && bun lint  # Final quality check
# Git hooks will automatically run on push
```

**Always validate changes work end-to-end before committing.**