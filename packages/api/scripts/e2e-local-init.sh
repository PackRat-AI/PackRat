#!/usr/bin/env bash
# e2e-local-init.sh — generate packages/api/.dev.vars.e2e for local Maestro e2e.
#
# Copies your existing .dev.vars (or the main-checkout copy if that exists)
# and overrides the DB + API URLs to point at local Docker Postgres.
#
# Run once per worktree setup, or whenever you want to reset the e2e vars.
# The generated .dev.vars.e2e is gitignored.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "${API_DIR}/../.." && pwd)"

E2E_DB_URL="postgres://e2e_user:e2e_pass@127.0.0.1:5435/packrat_e2e"
OUT="${API_DIR}/.dev.vars.e2e"

# Candidate source files (in order of preference)
CANDIDATES=(
  "${API_DIR}/.dev.vars"
  "${REPO_ROOT}/../development/packages/api/.dev.vars"
)

SOURCE=""
for candidate in "${CANDIDATES[@]}"; do
  if [[ -f "$candidate" ]]; then
    SOURCE="$candidate"
    break
  fi
done

if [[ -z "$SOURCE" ]]; then
  echo "Error: Could not find a base .dev.vars file."
  echo "  Checked:"
  for c in "${CANDIDATES[@]}"; do echo "    $c"; done
  echo ""
  echo "Copy .dev.vars.e2e.example to .dev.vars.e2e and fill in your secrets manually."
  exit 1
fi

echo "Using base vars from: ${SOURCE}"

# Stream the base file, overriding the keys that differ for local e2e.
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    NEON_DATABASE_URL=*)              echo "NEON_DATABASE_URL=${E2E_DB_URL}" ;;
    NEON_DATABASE_URL_READONLY=*)     echo "NEON_DATABASE_URL_READONLY=${E2E_DB_URL}" ;;
    EXPO_PUBLIC_API_URL=*)            echo "EXPO_PUBLIC_API_URL=http://localhost:8787" ;;
    BETTER_AUTH_URL=*)                echo "BETTER_AUTH_URL=http://localhost:8787" ;;
    *)                                echo "$line" ;;
  esac
done < "$SOURCE" > "$OUT"

# Append e2e credentials if not already present.
if ! grep -q "^E2E_TEST_EMAIL=" "$OUT"; then
  echo "" >> "$OUT"
  echo "E2E_TEST_EMAIL=${E2E_TEST_EMAIL:-e2e@packrattest.local}" >> "$OUT"
fi
if ! grep -q "^E2E_TEST_PASSWORD=" "$OUT"; then
  echo "E2E_TEST_PASSWORD=${E2E_TEST_PASSWORD:-E2eTestPass123!}" >> "$OUT"
fi
if ! grep -q "^E2E_TEST_USER_ID=" "$OUT"; then
  echo "E2E_TEST_USER_ID=${E2E_TEST_USER_ID:-00000000-0000-4000-8000-000000000001}" >> "$OUT"
fi

echo "Generated: ${OUT}"
echo ""
echo "Next steps:"
echo "  1. Review ${OUT} and confirm the values look correct."
echo "  2. Run: scripts/e2e-local-start.sh"
