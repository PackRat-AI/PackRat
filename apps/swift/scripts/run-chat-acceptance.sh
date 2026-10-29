#!/usr/bin/env bash
# Dedicated local-only runner; never reads E2E credentials or starts a worker.
set -euo pipefail
if [[ $# -ne 1 || -z "$1" ]]; then
  echo 'Usage: bash apps/swift/scripts/run-chat-acceptance.sh <owned-iOS-simulator-UDID>' >&2
  exit 2
fi
chat_simulator_id="$1"
chat_repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
chat_derived_data="$HOME/Library/Developer/Xcode/DerivedData/PackRat-shared"
chat_log_dir="$(mktemp -d "${TMPDIR:-/tmp}/packrat-chat-acceptance.XXXXXX")"
chat_server_pid=''
cleanup() {
  if [[ -n "$chat_server_pid" ]]; then
    kill "$chat_server_pid" 2>/dev/null || true
    wait "$chat_server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
cd "$chat_repo_root/apps/swift"
xcodegen generate
bun scripts/fix-xcodeproj.ts
chat_build_args=(
  -project PackRat.xcodeproj -scheme PackRat-iOS -configuration Debug
  -destination "platform=iOS Simulator,id=$chat_simulator_id"
  -derivedDataPath "$chat_derived_data" -testPlan iOS-ChatAcceptance
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO
  PACKRAT_ENV=local SENTRY_DSN= REVENUECAT_API_KEY=
)
xcodebuild build-for-testing "${chat_build_args[@]}"
python3 scripts/lib/verify-chat-acceptance-build.py \
  "$chat_derived_data/Build/Products/Debug-iphonesimulator"
# Node HTTP emits response close on peer cancellation; Bun 1.3.14 does not
# reliably emit it on macOS. Bundle only, then execute the fixture with Node.
bun build scripts/chat-acceptance-server.ts --target node --outfile "$chat_log_dir/server.mjs"
node "$chat_log_dir/server.mjs" > "$chat_log_dir/server.log" 2>&1 &
chat_server_pid=$!
# Wait only for our own process to bind. Never attach to an existing listener.
for attempt in {1..50}; do
  if ! kill -0 "$chat_server_pid" 2>/dev/null; then
    echo "Fixture failed to start; see $chat_log_dir/server.log" >&2
    exit 1
  fi
  if grep -q 'Chat fixture listening only' "$chat_log_dir/server.log"; then
    break
  fi
  sleep 0.1
done
if ! grep -q 'Chat fixture listening only' "$chat_log_dir/server.log"; then
  echo 'Fixture startup timed out' >&2
  exit 1
fi
# No build occurs after plist verification. The plan supplies only the fixed
# loopback fixture address; XCTest supplies the existing synthetic seed identity.
xcodebuild test-without-building "${chat_build_args[@]}" \
  -resultBundlePath "$chat_log_dir/ChatAcceptance.xcresult"
echo "Chat acceptance result: $chat_log_dir/ChatAcceptance.xcresult"
