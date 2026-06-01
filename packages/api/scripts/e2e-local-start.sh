#!/usr/bin/env bash
# e2e-local-start.sh — spin up local Postgres + Bun API for Maestro e2e.
#
# Prerequisites:
#   - Docker running
#   - .dev.vars.e2e generated (run bun run dev:e2e:init if missing)
#   - Bun installed
#
# The API will be available at http://localhost:${PORT:-8787}.
# Android physical devices can reach it via:
#   adb reverse tcp:${PORT:-8787} tcp:${PORT:-8787}
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${API_DIR}/docker-compose.e2e.yml"
E2E_VARS="${E2E_VARS:-${API_DIR}/.dev.vars.e2e}"
E2E_DB_PORT="${E2E_DB_PORT:-5435}"
E2E_DB_URL="${E2E_DB_URL:-postgres://e2e_user:e2e_pass@localhost:${E2E_DB_PORT}/packrat_e2e}"
API_PORT="${PORT:-8787}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-packrat_e2e_${E2E_DB_PORT}}"
export E2E_DB_PORT

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
echo "▶ Starting local Postgres (packrat_e2e on port ${E2E_DB_PORT})..."
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
E2E_EMAIL="${E2E_TEST_EMAIL:-$(grep '^E2E_TEST_EMAIL=' "$E2E_VARS" 2>/dev/null || true | cut -d= -f2-)}"
E2E_PASS="${E2E_TEST_PASSWORD:-$(grep '^E2E_TEST_PASSWORD=' "$E2E_VARS" 2>/dev/null || true | cut -d= -f2-)}"
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

# ── Local API ────────────────────────────────────────────────────────────────
echo ""
echo "▶ Starting local E2E API on http://localhost:${API_PORT} ..."
echo "  Using env file: ${E2E_VARS}"
echo "  Press Ctrl+C to stop."
echo ""

cd "$API_DIR"
set -a
# shellcheck disable=SC1090
source "$E2E_VARS"
set +a

exec env \
  PORT="$API_PORT" \
  NODE_ENV=test \
  NEON_DATABASE_URL="$E2E_DB_URL" \
  NEON_DATABASE_URL_READONLY="$E2E_DB_URL" \
  BETTER_AUTH_URL="http://127.0.0.1:${API_PORT}" \
  PACKRAT_PG_POOL_MAX="${PACKRAT_PG_POOL_MAX:-50}" \
  bun run dev:e2e:node
