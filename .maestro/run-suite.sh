#!/bin/bash
# PackRat Maestro E2E Test Suite Runner
# Usage:
#   TEST_EMAIL=x TEST_PASSWORD=y .maestro/run-suite.sh [ios|android] [maestro args...]
#
# Examples:
#   TEST_EMAIL=x TEST_PASSWORD=y .maestro/run-suite.sh android --device emulator-5554
#   TEST_EMAIL=x TEST_PASSWORD=y .maestro/run-suite.sh ios --format junit --output test-results.xml

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${1:-android}"

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "android" ]; then
  shift || true
else
  echo "ERROR: first argument must be 'ios' or 'android' (default: android)"
  exit 1
fi

if [ -z "${TEST_EMAIL:-}" ] || [ -z "${TEST_PASSWORD:-}" ]; then
  echo "ERROR: TEST_EMAIL and TEST_PASSWORD must be set"
  exit 1
fi

UNIQUE_ID="$(date +%s)"

if [ "$PLATFORM" = "ios" ]; then
  START_DATE="$(date -j -v+7d +"%Y-%m-%d")"
  END_DATE="$(date -j -v+14d +"%Y-%m-%d")"
  TODAY_DATE="$(date -j +"%b %-d, %Y")"
  get_month() { date -j -f "%Y-%m-%d" "$1" +"%B"; }
  get_day() { date -j -f "%Y-%m-%d" "$1" +"%-d"; }
  get_year() { date -j -f "%Y-%m-%d" "$1" +"%Y"; }
  get_month_num() { date -j -f "%Y-%m-%d" "$1" +"%-m"; }
  CONFIG_FILE="$ROOT_DIR/.maestro/config.yaml"
  MASTER_FLOW="$ROOT_DIR/.maestro/master-flow.yaml"
  DEFAULT_APP_ID="com.andrewbierman.packrat.preview"
else
  START_DATE="$(date -d "+7 days" +"%Y-%m-%d")"
  END_DATE="$(date -d "+14 days" +"%Y-%m-%d")"
  TODAY_DATE="$(date +"%-d %b %Y")"
  get_month() { date -d "$1" +"%B"; }
  get_day() { date -d "$1" +"%d"; }
  get_year() { date -d "$1" +"%Y"; }
  get_month_num() { date -d "$1" +"%-m"; }
  CONFIG_FILE="$ROOT_DIR/.maestro/config-android.yaml"
  MASTER_FLOW="$ROOT_DIR/.maestro/master-flow-android.yaml"
  DEFAULT_APP_ID="com.packratai.mobile.preview"
fi

CURRENT_YEAR="$(date +"%Y")"
CURRENT_MONTH="$(date +"%-m")"
START_TAPS=$(( ($(get_year "$START_DATE") - CURRENT_YEAR) * 12 + ($(get_month_num "$START_DATE") - CURRENT_MONTH) ))
END_TAPS=$(( ($(get_year "$END_DATE") - CURRENT_YEAR) * 12 + ($(get_month_num "$END_DATE") - CURRENT_MONTH) ))

maestro test --config "$CONFIG_FILE" "$@" \
  -e TEST_EMAIL="$TEST_EMAIL" \
  -e TEST_PASSWORD="$TEST_PASSWORD" \
  -e METRO_HOST="${METRO_HOST:-localhost}" \
  -e METRO_PORT="${METRO_PORT:-8083}" \
  -e TRIP_NAME="${TRIP_NAME:-E2E-Trip-$UNIQUE_ID}" \
  -e PACK_NAME="${PACK_NAME:-E2E-Pack-$UNIQUE_ID}" \
  -e APP_ID="${APP_ID:-$DEFAULT_APP_ID}" \
  -e START_YEAR="$(get_year "$START_DATE")" \
  -e START_MONTH="$(get_month "$START_DATE")" \
  -e START_DAY="$(get_day "$START_DATE")" \
  -e START_TAPS="$START_TAPS" \
  -e END_YEAR="$(get_year "$END_DATE")" \
  -e END_MONTH="$(get_month "$END_DATE")" \
  -e END_DAY="$(get_day "$END_DATE")" \
  -e END_TAPS="$END_TAPS" \
  -e TODAY_DATE="$TODAY_DATE" \
  "$MASTER_FLOW"
