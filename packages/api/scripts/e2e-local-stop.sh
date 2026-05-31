#!/usr/bin/env bash
# e2e-local-stop.sh — tear down the local Postgres e2e stack.
#
# Stops and removes the Docker containers started by e2e-local-start.sh.
# Pass --volumes to also drop the Postgres data volume (full reset).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${API_DIR}/docker-compose.e2e.yml"
E2E_KV_DIR="${E2E_KV_PERSIST_DIR:-${API_DIR}/.wrangler/state/e2e-auth-kv}"

EXTRA_FLAGS=()
if [[ "${1:-}" == "--volumes" || "${1:-}" == "-v" ]]; then
  EXTRA_FLAGS+=(--volumes)
  echo "▶ Stopping and removing containers + data volume..."
else
  echo "▶ Stopping containers (data volume preserved)..."
  echo "  Pass --volumes to also wipe the Postgres data."
fi

docker compose -f "$COMPOSE_FILE" down "${EXTRA_FLAGS[@]}"
if [[ "${#EXTRA_FLAGS[@]}" -gt 0 ]]; then
  rm -rf "$E2E_KV_DIR"
fi
echo "Done."
