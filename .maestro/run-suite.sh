#!/bin/bash
# PackRat Maestro E2E Test Suite Runner
# Usage: .maestro/run-suite.sh
#
# Required env vars:
#   TEST_EMAIL       — test account email
#   TEST_PASSWORD    — test account password
# Or pass inline:
#   TEST_EMAIL=x TEST_PASSWORD=y .maestro/run-suite.sh

set -o pipefail

MAESTRO_DIR="$(cd "$(dirname "$0")" && pwd)"
PASSED=0
FAILED=0
SKIPPED=0
FAILURES=""

if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "ERROR: TEST_EMAIL and TEST_PASSWORD must be set"
  exit 1
fi

run_flow() {
  local flow="$1"
  local name=$(basename "$flow" .yaml)
  printf "%-45s " "$name"

  output=$(maestro test -e TEST_EMAIL="$TEST_EMAIL" -e TEST_PASSWORD="$TEST_PASSWORD" "$MAESTRO_DIR/$flow" 2>&1)
  result=$?

  if [ $result -eq 0 ]; then
    echo "PASS"
    PASSED=$((PASSED + 1))
  else
    echo "FAIL"
    FAILED=$((FAILED + 1))
    FAILURES="$FAILURES\n  - $name"
  fi
}

echo "=========================================="
echo "  PackRat E2E Test Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# Core flows (sequential, order matters)
FLOWS=(
  "flows/setup/clear-state.yaml"
  "flows/auth/login-flow.yaml"
  "flows/setup/session-persistence-flow.yaml"
  "flows/dashboard/dashboard-tiles-flow.yaml"
  "flows/dashboard/pack-templates-flow.yaml"
  "flows/packs/create-pack-flow.yaml"
  "flows/packs/pack-detail-flow.yaml"
  "flows/packs/pack-edit-share-flow.yaml"
  "flows/packs/pack-toggle-filter-flow.yaml"
  "flows/packs/add-item-manual-flow.yaml"
  "flows/packs/add-item-catalog-flow.yaml"
  "flows/packs/add-item-in-pack-catalog-flow.yaml"
  "flows/trips/create-trip-flow.yaml"
  "flows/trips/trip-detail-flow.yaml"
  "flows/trips/trip-edit-flow.yaml"
  "flows/catalog/catalog-browse-flow.yaml"
  "flows/catalog/catalog-search-flow.yaml"
  "flows/catalog/catalog-item-detail-flow.yaml"
  "flows/ai/ai-chat-dashboard-flow.yaml"
  "flows/ai/ai-chat-pack-flow.yaml"
  "flows/guides/guides-browse-flow.yaml"
  "flows/profile/profile-view-flow.yaml"
  "flows/auth/logout-flow.yaml"
  "flows/negative/invalid-login-flow.yaml"
  "flows/negative/empty-pack-submit-flow.yaml"
)

for flow in "${FLOWS[@]}"; do
  run_flow "$flow"
done

echo ""
echo "=========================================="
echo "  Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [ -n "$FAILURES" ]; then
  echo -e "\nFailed flows:$FAILURES"
fi

exit $FAILED
