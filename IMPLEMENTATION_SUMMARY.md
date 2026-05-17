# E2E Test Isolation Implementation Summary

## Problem Statement
E2E tests were sharing a development database and test user, leading to potential data conflicts and race conditions between concurrent test runs.

## Solution
Implemented infrastructure to provision isolated database and API instances per e2e test run.

## What's Included

### 1. Database Isolation Scripts

**`provision-e2e-db.ts`**
- Creates ephemeral Neon database branch per test run
- Runs all migrations automatically
- Seeds test user with provided credentials
- Returns connection string and branch info for cleanup
- Supports GitHub Actions outputs

**`cleanup-e2e-db.ts`**
- Deletes ephemeral database branches
- Accepts branch info file or environment variables
- Safe to run multiple times (idempotent)

### 2. API Isolation Scripts

**`start-e2e-api.ts`**
- Starts local wrangler dev server
- Finds available port automatically
- Configures server with isolated database
- Health check polling for readiness
- Returns API URL and process info

**`stop-e2e-api.ts`**
- Cleanly shuts down API server
- Removes temporary configuration files
- Handles process cleanup

**`expose-e2e-api.ts`**
- Exposes local API via ngrok tunnel
- Supports authenticated tunnels for persistent URLs
- Returns public URL for mobile app connectivity
- Manages tunnel lifecycle

### 3. CI/CD Integration

Updated `.github/workflows/e2e-tests.yml`:
- Provisions ephemeral database before each test run (iOS & Android)
- Seeds test user during provisioning
- Cleans up database branch after tests (even on failure)
- Updated secret requirements:
  - `NEON_API_KEY` - for branch management
  - `NEON_PROJECT_ID` - target project
  - `NEON_PARENT_BRANCH_ID` (optional) - defaults to 'main'

### 4. Documentation

**`E2E_TESTING.md`**
- Architecture diagrams (database-only vs full isolation)
- Script usage examples
- GitHub Actions integration guide
- Local development workflows
- Troubleshooting guide
- Best practices and limitations

## Current State

### Active in CI (Database Isolation)
```
Mobile App → Dev API → Ephemeral Database Branch
```

**Benefits:**
- ✅ Isolated data per test run
- ✅ No database conflicts between runs
- ✅ Automatic cleanup
- ✅ Fast (no additional infrastructure)

**Trade-offs:**
- Dev API is still shared (can't test API changes before deployment)
- Requires dev API to be functional

### Available (Full Isolation)
```
Mobile App → Ngrok Tunnel → Local API → Ephemeral Database Branch
```

**Benefits:**
- ✅ Complete isolation
- ✅ Test API changes locally
- ✅ No dependency on shared infrastructure

**Trade-offs:**
- Slower startup (~30-60s for tunnel)
- Requires ngrok account for stable URLs
- More complex setup

## Required GitHub Secrets

To use the new infrastructure, add these secrets:

```bash
gh secret set NEON_API_KEY --repo PackRat-AI/PackRat
gh secret set NEON_PROJECT_ID --repo PackRat-AI/PackRat
gh secret set E2E_TEST_EMAIL --repo PackRat-AI/PackRat
gh secret set E2E_TEST_PASSWORD --repo PackRat-AI/PackRat

# Optional - for full isolation
gh secret set NGROK_AUTH_TOKEN --repo PackRat-AI/PackRat
```

## Package.json Scripts

Added to `packages/api/package.json`:

- `e2e:provision-db` - Provision ephemeral database
- `e2e:cleanup-db` - Cleanup database branch
- `e2e:start-api` - Start isolated API server
- `e2e:stop-api` - Stop API server
- `e2e:expose-api` - Expose API via tunnel

## Local Development

### Quick Start (Database Only)

```bash
# 1. Provision database
export NEON_API_KEY="your-key"
export NEON_PROJECT_ID="your-project"
export E2E_TEST_EMAIL="test@example.com"
export E2E_TEST_PASSWORD="Password123!"
bun run --filter @packrat/api e2e:provision-db

# 2. Run tests (app uses dev API + isolated DB)
# ...

# 3. Cleanup
bun run --filter @packrat/api e2e:cleanup-db /tmp/e2e-branch-*.json
```

### Full Isolation

```bash
# 1. Provision database
bun run --filter @packrat/api e2e:provision-db

# 2. Start local API
export E2E_DATABASE_URL="<url-from-step-1>"
bun run --filter @packrat/api e2e:start-api &

# 3. Expose via tunnel
export E2E_API_URL="http://localhost:8787"
bun run --filter @packrat/api e2e:expose-api &

# 4. Run tests with tunnel URL
export EXPO_PUBLIC_API_URL="<tunnel-url>"
# Run tests...

# 5. Cleanup all
kill $(cat /tmp/e2e-api-*.json | jq -r '.pid')
kill $(cat /tmp/e2e-tunnel-*.json | jq -r '.pid')
bun run --filter @packrat/api e2e:cleanup-db /tmp/e2e-branch-*.json
```

## Testing the Implementation

### Prerequisites
1. Set up Neon API credentials
2. Ensure all secrets are configured in GitHub
3. (Optional) Install ngrok for full isolation

### Test Locally

```bash
# Test database provisioning
cd packages/api
export NEON_API_KEY="..." NEON_PROJECT_ID="..." \
  E2E_TEST_EMAIL="test@test.com" E2E_TEST_PASSWORD="Test123!"
bun run e2e:provision-db

# Verify migrations ran
psql $E2E_DATABASE_URL -c "\dt"

# Verify test user exists
psql $E2E_DATABASE_URL -c "SELECT email FROM users WHERE email = 'test@test.com';"

# Cleanup
bun run e2e:cleanup-db /tmp/e2e-branch-*.json
```

### Test in CI
1. Push changes to a PR
2. Workflow will run on push to main/development
3. Check Actions logs to verify:
   - Database branch created
   - Migrations applied
   - Test user seeded
   - Tests run successfully
   - Branch cleaned up

## Next Steps

1. **Monitor first CI runs** to ensure cleanup works correctly
2. **Set up branch limit monitoring** on Neon project (they have limits)
3. **Consider enabling full isolation** if API changes need testing
4. **Document any edge cases** discovered during usage

## Future Enhancements

1. **Runtime API URL override** in mobile app to avoid pre-building
2. **Branch pooling** - pre-create branches for faster provisioning
3. **Parallel test support** - multiple concurrent runs with different branches
4. **Cloudflare Tunnels** - alternative to ngrok with better reliability
5. **Migration caching** - speed up branch setup

## Files Changed

- `.github/workflows/e2e-tests.yml` - CI/CD integration
- `packages/api/package.json` - New scripts
- `packages/api/scripts/provision-e2e-db.ts` - Database provisioning
- `packages/api/scripts/cleanup-e2e-db.ts` - Database cleanup
- `packages/api/scripts/start-e2e-api.ts` - API server management
- `packages/api/scripts/stop-e2e-api.ts` - API cleanup
- `packages/api/scripts/expose-e2e-api.ts` - Tunnel exposure
- `packages/api/scripts/update-cf-db-url.ts` - Cloudflare env updates (for reference)
- `packages/api/scripts/E2E_TESTING.md` - Complete documentation

## References

- [Neon Branching Documentation](https://neon.tech/docs/guides/branching)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Ngrok Documentation](https://ngrok.com/docs)
