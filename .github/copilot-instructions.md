# PackRat Development Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

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
- **API Tests**: `cd packages/api && bun test` -- NEVER CANCEL: Takes <1 second but may have environment errors
- Tests expect environment variables to be configured

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
2. Test health check: `curl http://localhost:8787/api/health` (expect 401 unauthorized)
3. Verify API is responding on port 8787

### **Web Apps Validation** 
1. **Guides App**: 
   - Start: `cd apps/guides && bun dev`
   - Test: `curl http://localhost:3001` (expect HTML response)
   - Content generation works: builds 49+ posts, 29+ categories

2. **Landing Page**:
   - Start: `cd apps/landing && bun dev` 
   - Test: `curl http://localhost:3000` (expect HTML response)

### **Mobile App Validation**
- Cannot fully test mobile UI in this environment
- Verify Expo development server starts without errors
- Check that `expo-doctor` passes

## Repository Structure

### **Key Directories**
- `apps/expo/` - React Native mobile application
- `apps/guides/` - Next.js guides website
- `apps/landing/` - Next.js landing page
- `packages/api/` - Hono.js API on Cloudflare Workers
- `packages/ui/` - Shared UI components

### **Key Files**
- `package.json` - Root monorepo configuration
- `biome.json` - Code formatting and linting rules  
- `bunfig.toml` - GitHub package authentication config
- `lefthook.yml` - Git hooks configuration
- `packages/api/wrangler.jsonc` - Cloudflare Workers configuration

### **Configuration Files**
- `.env.example` - Template for environment variables
- `tsconfig.base.json` - Base TypeScript configuration
- `.github/workflows/` - CI/CD pipelines

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
- `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` - Required for private package access
- `NEON_DATABASE_URL` - Database connection
- `OPENAI_API_KEY` - AI features
- `EXPO_PUBLIC_*` - Client-side Expo variables

## Time Expectations and Timeouts

**CRITICAL: NEVER CANCEL long-running operations. Always set appropriate timeouts:**

- **bun install**: 60-120 seconds timeout
- **bun format**: <1 second 
- **bun lint**: ~1 second
- **Development server startup**: 30-60 seconds timeout
- **API startup**: 60 seconds timeout  
- **Builds**: 300+ seconds timeout (may fail on network issues)
- **Expo commands**: 180+ seconds timeout

**Always wait for commands to complete rather than canceling them.**