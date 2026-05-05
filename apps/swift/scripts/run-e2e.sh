#!/usr/bin/env bash
# Run PackRat Swift XCUITests with credentials loaded from repo-root .env.local.
#
# Usage:  bun e2e:swift                   (run all UI tests)
#         bun e2e:swift -only <test>      (run a specific test method)
#
# Required env vars (in .env.local):
#   E2E_EMAIL
#   E2E_PASSWORD

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${E2E_EMAIL:-}" || -z "${E2E_PASSWORD:-}" ]]; then
  echo "❌ E2E_EMAIL and E2E_PASSWORD must be set in .env.local"
  exit 1
fi

# Pick first booted iPhone simulator, fall back to a known iPhone 16
DEST_ID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/{print $2; exit}')"
if [[ -z "$DEST_ID" ]]; then
  DEST="platform=iOS Simulator,name=iPhone 16"
else
  DEST="platform=iOS Simulator,id=$DEST_ID"
fi

cd "$REPO_ROOT/apps/swift"

# xcodebuild forwards build settings starting with TEST_RUNNER_ to the
# XCUITest runner process as env vars (with the prefix stripped). So
# TEST_RUNNER_E2E_EMAIL=foo arrives in test code as ProcessInfo.processInfo
# .environment["E2E_EMAIL"] == "foo".

# Pass any extra args to xcodebuild (e.g. -only-testing:PackRatUITests/AuthTests)
exec xcodebuild test \
  -scheme PackRat-iOS \
  -destination "$DEST" \
  -only-testing:PackRatUITests \
  TEST_RUNNER_E2E_EMAIL="$E2E_EMAIL" \
  TEST_RUNNER_E2E_PASSWORD="$E2E_PASSWORD" \
  "$@"
