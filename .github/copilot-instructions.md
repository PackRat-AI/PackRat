# PackRat - Outdoor Adventure Planning Platform

PackRat is a modern full-stack application for outdoor enthusiasts to plan and organize their adventures. Built with React Native/Expo for mobile, Next.js for web, and Cloudflare Workers for API, all managed in a monorepo using Bun.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Prerequisites and Installation
Install required tools and authenticate:

1. **Install Bun (Primary Package Manager)**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc
   ```

2. **Install GitHub CLI for Package Authentication**:
   ```bash
   # macOS: brew install gh
   # Windows: winget install --id GitHub.cli
   # Linux: see https://github.com/cli/cli#installation
   ```

3. **Authenticate with GitHub for Private Packages**:
   ```bash
   gh auth login
   gh auth refresh -h github.com -s read:packages
   ```

4. **Install Global Tools**:
   ```bash
   bun add -g @expo/cli wrangler
   ```

### Setup and Dependencies
- **Install Dependencies**: `bun install` -- NEVER CANCEL: takes up to 60 seconds, set timeout to 120+ seconds
- **Clean Install**: `bun clean && bun install` -- NEVER CANCEL: takes up to 90 seconds, set timeout to 180+ seconds
- **GitHub Authentication**: Required for `@packrat-ai/nativewindui` private package. Without authentication, `bun install` will fail with 401 errors

### Build and Development Commands

#### **Format and Lint** (Fast Operations)
- **Format Code**: `bun format` -- takes <1 second, formats 613+ files
- **Lint Code**: `bun lint` -- takes ~1 second, may show warnings 
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
# Start Expo development server
bun expo

# Or run directly on device/simulator  
bun android  # for Android
bun ios       # for iOS
```
- NEVER CANCEL: Expo commands can take 2+ minutes, set timeout to 180+ seconds

**Landing Page (Next.js)**:
```bash
cd apps/landing
bun dev
```
- NEVER CANCEL: Takes ~1.4 seconds to start, set timeout to 30+ seconds
- Runs on `http://localhost:3000`

**Guides Site (Next.js)**:
```bash
cd apps/guides  
bun dev
```
- NEVER CANCEL: Takes ~1.4 seconds to start, set timeout to 30+ seconds
- Runs on `http://localhost:3001` (if 3000 is taken)

#### **Build Commands**
- **Guides Build**: `cd apps/guides && bun run build` -- NEVER CANCEL: May fail on Google Fonts in restricted networks, set timeout to 300+ seconds
- **Landing Build**: `cd apps/landing && bun run build` -- NEVER CANCEL: May fail on Google Fonts in restricted networks, set timeout to 300+ seconds

#### **Testing**
- **API Tests**: `cd packages/api && bun test` -- NEVER CANCEL: Takes <2 seconds but may have environment errors
- Tests expect environment variables to be configured
- Typical results: 269+ pass, 79+ fail (failures expected due to missing env vars and 404 responses)

### Typical Development Workflow
For mobile development with API backend:
```bash
# Terminal 1: Start the API
bun api

# Terminal 2: Start the mobile app  
bun expo
```

## Validation Scenarios

Always manually validate changes by running complete user scenarios:

### **API Validation**
1. Start API: `bun api`
2. Test health check: `curl http://localhost:8787/` (expect `{"error":"Internal server error"}` due to missing env vars)
3. Verify API is responding on port 8787
4. Note: API shows network warnings about `workers.cloudflare.com` and `Request.cf` object - these are expected in restricted environments

### **Web Apps Validation** 
1. **Guides App**: 
   - Start: `cd apps/guides && bun dev`
   - Test: `curl http://localhost:3000` (expect HTML response)
   - Content generation works: builds 79+ posts, 29+ categories
   - Build command generates content first: `bun run build-content` creates posts from content generation script

2. **Landing Page**:
   - Start: `cd apps/landing && bun dev` 
   - Test: `curl http://localhost:3000` (expect HTML response)

### **Mobile App Validation**
- Cannot fully test mobile UI in this environment
- Verify Expo development server starts without errors on port 8081
- Check that `npx expo-doctor` runs (expect network-related failures in restricted environments)
- Metro runs in CI mode: "Metro is running in CI mode, reloads are disabled"

### **Code Quality Validation**
- Run `bun format && bun lint` - should complete without errors
- `bun format` processes 673+ files in <1 second
- `bun lint` may show minor warnings (expected)
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
- Many API endpoint tests return 404 (expected without full environment setup)
- Dependency management tools (`bun check:deps`, `bun fix:deps`) may show errors in monorepo setup

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

## Manual Validation Workflows

After making changes, always run these validation scenarios to ensure functionality:

### **Full Stack Development Validation**
1. Start API server: `bun api` (wait 10+ seconds for startup)
2. Start mobile app: `bun expo` (wait 30+ seconds for Metro)
3. Verify both services are running without crashes
4. Test basic API connectivity: `curl http://localhost:8787/`
5. Check Expo QR code generation (if applicable)

### **Web Application Validation**
1. **Guides App**:
   - `cd apps/guides && bun dev`
   - Test response: `curl -s http://localhost:3000 | head -5`
   - Verify content generation: `ls content/posts/ | wc -l` (expect 79+ files)
   
2. **Landing Page**:
   - `cd apps/landing && bun dev`
   - Test response: `curl -s http://localhost:3000 | head -5`
   - Verify different HTML content than guides app

### **Code Quality Validation Sequence**
Run these commands in order and verify all pass:
```bash
bun format      # <1 second, 673+ files
bun lint        # ~1 second, may show warnings
bun check-types # <30 seconds when deps installed
```

### **Build Validation (Expected Failures)**
Test builds to understand limitations:
```bash
cd apps/guides && bun run build   # Expect Google Fonts failure
cd apps/landing && bun run build  # Expect Google Fonts failure
```
These failures are normal in restricted network environments.

## Common Issues and Solutions

### **Authentication Issues**
- **Problem**: `bun install` fails with 401 errors
- **Solution**: Ensure GitHub CLI is authenticated with `read:packages` scope

### **Build Failures**
- **Problem**: Next.js builds fail with Google Fonts errors
- **Solution**: Expected in restricted networks, development servers work fine

### **Type Checking Failures**  
- **Problem**: `bun check-types` fails with module not found errors
- **Solution**: Expected without dependencies installed, install with `bun install` first

### **Port Conflicts**
- Landing page uses port 3000, guides use port 3001 if 3000 is taken
- API always uses port 8787
- Expo Metro bundler uses port 8081
- If ports conflict, stop existing services or use different terminals

### **Network and Environment Issues**
- **Problem**: Expo doctor fails with network errors
- **Solution**: Expected in restricted environments - `npx expo-doctor` will show 3+ check failures
- **Problem**: API shows "Unable to fetch Request.cf object" warnings
- **Solution**: Expected behavior in development - API still functions normally
- **Problem**: Builds fail with Google Fonts ENOTFOUND errors
- **Solution**: Expected in restricted networks - development servers work fine

## Git Workflow
- **Pre-push Hook**: Automatically runs `bun format` 
- **Skip Hooks**: `git push --no-verify` (if needed temporarily)
- **Quality Commands**: Always run `bun format && bun lint` before committing

## Architecture Notes
- **Package Manager**: Bun (primary), some legacy PNPM files exist
- **Monorepo**: Uses Bun workspaces
- **Mobile**: React Native with Expo
- **Web**: Next.js 15+ with React 19
- **API**: Hono.js on Cloudflare Workers with Wrangler CLI
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with custom UI components
- **Code Quality**: Biome for formatting and linting

## Environment Variables
See `.env.example` for complete list. Key variables:
- `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` - Required for private package access (configured automatically in CI)
- `NEON_DATABASE_URL` - Database connection (API will return internal server errors without this)
- `OPENAI_API_KEY` - AI features (needed for content generation and chat)
- `EXPO_PUBLIC_*` - Client-side Expo variables (only PUBLIC_ prefixed vars are bundled)

**Environment Detection**: Scripts automatically detect CI environments and skip `.env.local` generation when `CI=true`.

## Time Expectations and Timeouts

**CRITICAL: NEVER CANCEL long-running operations. Always set appropriate timeouts:**

- **bun install**: 60-120 seconds timeout (installs 1620+ packages in ~52s)
- **bun format**: <1 second (processes 673+ files in ~367ms)
- **bun lint**: ~1-2 seconds (checks 673+ files in ~1.165s)
- **Development server startup**: 30-60 seconds timeout
- **API startup**: 60 seconds timeout (ready in ~10s with network warnings)
- **Expo startup**: 180+ seconds timeout (Metro bundler startup)
- **Next.js dev servers**: 30 seconds timeout (ready in ~1.4s)
- **Builds**: 300+ seconds timeout (may fail on network issues)
- **API tests**: 30+ seconds timeout (runs 348 tests in ~1.6s)

**Always wait for commands to complete rather than canceling them.**
