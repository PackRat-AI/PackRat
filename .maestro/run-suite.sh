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

date_ymd_offset() {
  node -e "const d = new Date(); d.setDate(d.getDate() + Number(process.argv[1])); console.log(d.toISOString().slice(0, 10));" "$1"
}

date_part() {
  node -e "const d = new Date(process.argv[1] + 'T00:00:00Z'); const part = process.argv[2]; if (part === 'month') console.log(new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(d)); if (part === 'day') console.log(String(d.getUTCDate()).padStart(Number(process.argv[3] || 0), '0')); if (part === 'year') console.log(String(d.getUTCFullYear())); if (part === 'month-num') console.log(String(d.getUTCMonth() + 1));" "$1" "$2" "${3:-0}"
}

today_label() {
  node -e "const d = new Date(); const platform = process.argv[1]; if (platform === 'ios') console.log(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)); else console.log(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d));" "$1"
}

if [ "$PLATFORM" = "ios" ]; then
  START_DATE="$(date_ymd_offset 7)"
  END_DATE="$(date_ymd_offset 14)"
  TODAY_DATE="$(today_label ios)"
  get_month() { date_part "$1" month; }
  get_day() { date_part "$1" day; }
  get_year() { date_part "$1" year; }
  get_month_num() { date_part "$1" month-num; }
  CONFIG_FILE="$ROOT_DIR/.maestro/config.yaml"
  MASTER_FLOW="$ROOT_DIR/.maestro/master-flow.yaml"
  DEFAULT_APP_ID="com.andrewbierman.packrat.preview"
else
  START_DATE="$(date_ymd_offset 7)"
  END_DATE="$(date_ymd_offset 14)"
  TODAY_DATE="$(today_label android)"
  get_month() { date_part "$1" month; }
  get_day() { date_part "$1" day 2; }
  get_year() { date_part "$1" year; }
  get_month_num() { date_part "$1" month-num; }
  CONFIG_FILE="$ROOT_DIR/.maestro/config-android.yaml"
  MASTER_FLOW="$ROOT_DIR/.maestro/master-flow-android.yaml"
  DEFAULT_APP_ID="com.packratai.mobile.preview"
fi

DEFAULT_METRO_HOST="${DEFAULT_METRO_HOST:-localhost}"

CURRENT_YEAR="$(date +"%Y")"
CURRENT_MONTH="$(date +"%-m")"
START_TAPS=$(( ($(get_year "$START_DATE") - CURRENT_YEAR) * 12 + ($(get_month_num "$START_DATE") - CURRENT_MONTH) ))
END_TAPS=$(( ($(get_year "$END_DATE") - CURRENT_YEAR) * 12 + ($(get_month_num "$END_DATE") - CURRENT_MONTH) ))

maestro test --config "$CONFIG_FILE" "$@" \
  -e TEST_EMAIL="$TEST_EMAIL" \
  -e TEST_PASSWORD="$TEST_PASSWORD" \
  -e METRO_HOST="${METRO_HOST:-$DEFAULT_METRO_HOST}" \
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
