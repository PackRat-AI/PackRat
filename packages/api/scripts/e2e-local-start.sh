#!/usr/bin/env bash
# e2e-local-start.sh — spin up local Postgres + wrangler dev for Maestro e2e.
#
# Prerequisites:
#   - Docker running
#   - .dev.vars.e2e generated (run scripts/e2e-local-init.sh if missing)
#   - Bun installed
#
# The API will be available at http://localhost:8787
# iOS Simulator can reach it at http://localhost:8787 (shared loopback on macOS).
# For a real device on the same Wi-Fi, use your Mac's LAN IP instead:
#   EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8787
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${API_DIR}/docker-compose.e2e.yml"
E2E_VARS="${API_DIR}/.dev.vars.e2e"
E2E_DB_URL="postgres://e2e_user:e2e_pass@localhost:5435/packrat_e2e"

# ── Preflight ───────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Error: Docker not found. Install Docker Desktop and try again."
  exit 1
fi

if [[ ! -f "$E2E_VARS" ]]; then
  echo "Error: ${E2E_VARS} not found."
  echo "Run first: bun run --filter @packrat/api dev:e2e:init"
  exit 1
fi

# ── Start Postgres ───────────────────────────────────────────────────────────
echo "▶ Starting local Postgres (packrat_e2e on port 5435)..."
docker compose -f "$COMPOSE_FILE" up -d

echo "▶ Waiting for Postgres to be ready..."
RETRIES=30
until docker compose -f "$COMPOSE_FILE" exec -T postgres-e2e \
    pg_isready -U e2e_user -d packrat_e2e &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -le 0 ]]; then
    echo "Error: Postgres did not become healthy in time."
    docker compose -f "$COMPOSE_FILE" logs postgres-e2e
    exit 1
  fi
  sleep 1
done
echo "  Postgres ready."

# ── Migrations ───────────────────────────────────────────────────────────────
echo "▶ Running schema migrations..."
(
  cd "$API_DIR"
  NEON_DATABASE_URL="$E2E_DB_URL" bun run db:migrate
)

# ── Seed E2E user ────────────────────────────────────────────────────────────
E2E_EMAIL="${E2E_TEST_EMAIL:-$(grep '^E2E_TEST_EMAIL=' "$E2E_VARS" | cut -d= -f2-)}"
E2E_PASS="${E2E_TEST_PASSWORD:-$(grep '^E2E_TEST_PASSWORD=' "$E2E_VARS" | cut -d= -f2-)}"
E2E_EMAIL="${E2E_EMAIL:-e2e@packrattest.local}"
E2E_PASS="${E2E_PASS:-E2eTestPass123!}"

echo "▶ Seeding E2E test user (${E2E_EMAIL})..."
(
  cd "$API_DIR"
  NEON_DATABASE_URL="$E2E_DB_URL" \
  E2E_TEST_EMAIL="$E2E_EMAIL" \
  E2E_TEST_PASSWORD="$E2E_PASS" \
  bun run db:seed:e2e-user
)

# ── Wrangler dev ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Starting wrangler dev on http://localhost:8787 ..."
echo "  Using env file: ${E2E_VARS}"
echo "  Press Ctrl+C to stop."
echo ""

cd "$API_DIR"
# --env-file layers e2e vars on top of any existing .dev.vars;
# --ip 0.0.0.0 also exposes the API on the LAN (useful for real device testing).
exec wrangler dev -e dev \
  --env-file "$E2E_VARS" \
  --ip 0.0.0.0
