# E2E Testing with Isolated Database and API

This directory contains scripts for provisioning isolated database branches and API instances for end-to-end (e2e) testing.

## Overview

The e2e testing infrastructure provides:

1. **Isolated Database**: Ephemeral Neon database branch per test run
2. **Test User**: Automatically provisioned in the isolated database  
3. **API Isolation** (optional): Local API instance with tunnel exposure
4. **Automatic Cleanup**: Database branches and processes cleaned up after tests

## Architecture

### Current CI Setup (Simplified)

```
┌─────────────────┐
│  Mobile App     │──────┐
│  (Pre-built)    │      │
└─────────────────┘      │
                         │
                         ▼
                   ┌──────────────┐     ┌──────────────────┐
                   │  Dev API     │────▶│ Ephemeral DB     │
                   │ (Cloudflare) │     │ (Neon Branch)    │
                   └──────────────┘     └──────────────────┘
```

**How it works**:
- Each test run provisions a new Neon database branch
- Test user is seeded automatically
- Mobile app connects to existing dev API
- Tests use unique identifiers (via `github.run_id`) to avoid conflicts
- Database branch is deleted after tests complete

### Full Isolation Setup (Optional)

```
┌─────────────────┐
│  Mobile App     │──────┐
│  (Pre-built)    │      │
└─────────────────┘      │
                         │
                         ▼
                   ┌──────────────┐     ┌──────────────────┐
                   │  Ngrok       │────▶│  Local API       │
                   │  (Tunnel)    │     │  (Wrangler Dev)  │
                   └──────────────┘     └──────────────────┘
                                               │
                                               ▼
                                        ┌──────────────────┐
                                        │ Ephemeral DB     │
                                        │ (Neon Branch)    │
                                        └──────────────────┘
```

**How it works**:
- Provisions ephemeral database branch
- Starts local wrangler dev server with isolated database
- Exposes local API via ngrok tunnel
- Mobile app connects to tunnel URL
- Complete isolation from shared infrastructure

## Scripts

### Database Provisioning

#### `provision-e2e-db.ts`

Creates an ephemeral Neon database branch, runs migrations, and seeds test user.

```bash
# Required environment variables
export NEON_API_KEY="neon-api-key"
export NEON_PROJECT_ID="project-id"
export E2E_TEST_EMAIL="test@example.com"
export E2E_TEST_PASSWORD="Password123!"

# Optional
export NEON_PARENT_BRANCH_ID="main"  # Default: main

# Run
bun run --filter @packrat/api e2e:provision-db
```

**Outputs**:
- `E2E_BRANCH_ID`: Branch ID for cleanup
- `E2E_DATABASE_URL`: Connection string
- `/tmp/e2e-branch-{timestamp}.json`: Branch info file

#### `cleanup-e2e-db.ts`

Deletes an ephemeral database branch.

```bash
# Option 1: Using branch info file
bun run --filter @packrat/api e2e:cleanup-db /tmp/e2e-branch-1234567890.json

# Option 2: Using environment variables
export NEON_API_KEY="neon-api-key"
export NEON_PROJECT_ID="project-id"
export E2E_BRANCH_ID="br-xxx"
bun run --filter @packrat/api e2e:cleanup-db
```

### API Instance Management

#### `start-e2e-api.ts`

Starts a local wrangler dev server with isolated database.

```bash
export E2E_DATABASE_URL="postgres://..."

# Optional
export E2E_API_PORT=8787  # Default: 8787
export E2E_VARS_FILE=".dev.vars"  # Base vars to extend

bun run --filter @packrat/api e2e:start-api
```

**Outputs**:
- `E2E_API_PID`: Process ID for cleanup
- `E2E_API_URL`: Local API URL
- `/tmp/e2e-api-{timestamp}.json`: Process info file

#### `stop-e2e-api.ts`

Stops a running E2E API instance.

```bash
# Option 1: Using process info file
bun run --filter @packrat/api e2e:stop-api /tmp/e2e-api-1234567890.json

# Option 2: Using environment variable
export E2E_API_PID=12345
bun run --filter @packrat/api e2e:stop-api
```

#### `expose-e2e-api.ts`

Exposes local API via ngrok tunnel (requires ngrok installed).

```bash
export E2E_API_URL="http://localhost:8787"

# Optional - for persistent URLs
export NGROK_AUTH_TOKEN="your-ngrok-token"

bun run --filter @packrat/api e2e:expose-api
```

**Outputs**:
- `TUNNEL_URL`: Public tunnel URL
- `TUNNEL_PID`: Ngrok process ID
- `/tmp/e2e-tunnel-{timestamp}.json`: Tunnel info file

## GitHub Actions Integration

### Required Secrets

Add these secrets to your GitHub repository:

```bash
# Core E2E secrets
gh secret set NEON_API_KEY --repo PackRat-AI/PackRat
gh secret set NEON_PROJECT_ID --repo PackRat-AI/PackRat
gh secret set E2E_TEST_EMAIL --repo PackRat-AI/PackRat
gh secret set E2E_TEST_PASSWORD --repo PackRat-AI/PackRat

# Vars file content (run this from PackRat root)
base64 -i packages/api/.dev.vars | gh secret set DEV_VARS_BASE64 --repo PackRat-AI/PackRat

# Optional
gh secret set NEON_PARENT_BRANCH_ID --repo PackRat-AI/PackRat  # Default: main
gh secret set NGROK_AUTH_TOKEN --repo PackRat-AI/PackRat  # For full isolation
```

### Workflow Example

The current workflow (`.github/workflows/e2e-tests.yml`) already integrates database isolation:

```yaml
- name: Provision ephemeral E2E database
  id: provision-db
  run: bun run --filter @packrat/api e2e:provision-db
  env:
    NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
    NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
    NEON_PARENT_BRANCH_ID: ${{ secrets.NEON_PARENT_BRANCH_ID || 'main' }}
    E2E_TEST_EMAIL: ${{ env.TEST_EMAIL }}
    E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}

- name: Cleanup ephemeral E2E database
  if: always()
  run: |
    if [ -n "$BRANCH_INFO_FILE" ]; then
      bun run --filter @packrat/api e2e:cleanup-db "$BRANCH_INFO_FILE" || true
    fi
  env:
    NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
    BRANCH_INFO_FILE: ${{ steps.provision-db.outputs.branch_info_file }}
```

For full isolation with local API + tunnel:

```yaml
- name: Create vars file from secret
  run: |
    echo "${{ secrets.DEV_VARS_BASE64 }}" | base64 -d > packages/api/.dev.vars-ci

- name: Start isolated E2E API server
  id: start-api
  run: bun run --filter @packrat/api e2e:start-api &
  env:
    E2E_DATABASE_URL: ${{ steps.provision-db.outputs.connection_uri }}
    E2E_VARS_FILE: packages/api/.dev.vars-ci

- name: Expose API via tunnel
  id: expose-api
  run: bun run --filter @packrat/api e2e:expose-api &
  env:
    E2E_API_URL: http://localhost:8787
    NGROK_AUTH_TOKEN: ${{ secrets.NGROK_AUTH_TOKEN }}

- name: Run tests
  env:
    EXPO_PUBLIC_API_URL: ${{ steps.expose-api.outputs.tunnel_url }}
```

## Local Development

### Quick Start

```bash
# 1. Provision database
export NEON_API_KEY="your-key"
export NEON_PROJECT_ID="your-project"
export E2E_TEST_EMAIL="test@example.com"
export E2E_TEST_PASSWORD="Password123!"

bun run --filter @packrat/api e2e:provision-db

# 2. Start local API (optional)
export E2E_DATABASE_URL="<url-from-step-1>"
bun run --filter @packrat/api e2e:start-api &

# 3. Run your tests
# ...

# 4. Cleanup
bun run --filter @packrat/api e2e:cleanup-db /tmp/e2e-branch-*.json
```

### With Tunnel (Full Isolation)

```bash
# 1. Provision database
bun run --filter @packrat/api e2e:provision-db

# 2. Start API
export E2E_DATABASE_URL="<url-from-step-1>"
bun run --filter @packrat/api e2e:start-api &

# 3. Expose via tunnel
export E2E_API_URL="http://localhost:8787"
bun run --filter @packrat/api e2e:expose-api &

# 4. Run tests with tunnel URL
export EXPO_PUBLIC_API_URL="<tunnel-url-from-step-3>"
# Run your tests...

# 5. Cleanup
kill $(cat /tmp/e2e-api-*.json | jq -r '.pid')
kill $(cat /tmp/e2e-tunnel-*.json | jq -r '.pid')
bun run --filter @packrat/api e2e:cleanup-db /tmp/e2e-branch-*.json
```

## Troubleshooting

### Database branch creation fails

**Error**: `Failed to create Neon branch: 401`

**Solution**: Check that `NEON_API_KEY` has correct permissions. Generate a new API key at https://console.neon.tech/app/settings/api-keys

### API won't start

**Error**: `Port 8787 already in use`

**Solution**: Either kill the existing process or use a different port:
```bash
export E2E_API_PORT=8788
```

### Ngrok tunnel fails

**Error**: `Timeout waiting for ngrok to start`

**Solution**:
1. Install ngrok: `brew install ngrok` (Mac) or download from https://ngrok.com
2. For persistent URLs, sign up and set authtoken:
   ```bash
   ngrok authtoken <your-token>
   ```

### Database branch not cleaned up

**Solution**: Manually delete via Neon console or API:
```bash
curl -X DELETE \
  "https://console.neon.tech/api/v2/projects/${PROJECT_ID}/branches/${BRANCH_ID}" \
  -H "Authorization: Bearer ${NEON_API_KEY}"
```

## Best Practices

1. **Always cleanup**: Use `if: always()` in CI workflows to ensure cleanup runs
2. **Unique identifiers**: Use `github.run_id` or timestamps for test data
3. **Database limits**: Neon has branch limits per project; cleanup old branches regularly
4. **API isolation**: Only use local API + tunnel when truly needed (slower)
5. **Secrets rotation**: Rotate API keys and tokens periodically

## Limitations

### Current Setup (Database Only)

- ✅ Isolated database per test run
- ✅ Automatic test user provisioning
- ✅ Fast (no additional infrastructure)
- ❌ Shares dev API (potential for interference)
- ❌ Can't test API changes before deployment

### Full Isolation (Database + API + Tunnel)

- ✅ Complete isolation
- ✅ Test API changes locally
- ❌ Slower startup (~30-60s for tunnel)
- ❌ Requires ngrok account for stable URLs
- ❌ More complex setup

## Future Improvements

1. **Runtime API configuration**: Update mobile app to support runtime API URL override (avoid pre-build)
2. **Cloudflare Tunnels**: Alternative to ngrok with better reliability
3. **Branch pooling**: Pre-create database branches for faster provisioning
4. **Parallel test isolation**: Support multiple concurrent test runs with different branches
5. **Local caching**: Cache migrations to speed up branch setup

## References

- [Neon Branching Docs](https://neon.tech/docs/guides/branching)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Ngrok Docs](https://ngrok.com/docs)
- [Maestro E2E Testing](https://maestro.mobile.dev/)
