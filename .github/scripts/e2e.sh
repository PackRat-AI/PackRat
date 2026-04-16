#!/bin/bash
set -e

PLATFORM=$1  # "ios" or "android"
shift  # Remove first argument so $@ contains only the additional options

# Require test credentials to be supplied via env (CI secrets or local .env.local).
# Never fall back to baked-in defaults.
if [ -z "${TEST_EMAIL:-}" ] || [ -z "${TEST_PASSWORD:-}" ]; then
  echo "ERROR: TEST_EMAIL and TEST_PASSWORD must be set (via CI secrets or a gitignored .env.local)" >&2
  exit 1
fi

# Generate unique ID for this test run
UNIQUE_ID=$(date +%s)

if [ "$PLATFORM" = "ios" ]; then
  START_DATE=$(date -j -v+7d +"%Y-%m-%d")
  END_DATE=$(date -j -v+14d +"%Y-%m-%d")
  TODAY_DATE=$(date -j +"%b %-d, %Y")   # e.g. "Apr 16, 2026"
  get_month() { date -j -f "%Y-%m-%d" "$1" +"%B"; }
  get_day()   { date -j -f "%Y-%m-%d" "$1" +"%-d"; }
  get_year()  { date -j -f "%Y-%m-%d" "$1" +"%Y"; }
  get_month_num() { date -j -f "%Y-%m-%d" "$1" +"%-m"; }
else
  START_DATE=$(date -d "+7 days" +"%Y-%m-%d")
  END_DATE=$(date -d "+14 days" +"%Y-%m-%d")
  TODAY_DATE=$(date +"%-d %b %Y")
  get_month() { date -d "$1" +"%B"; }
  get_day()   { date -d "$1" +"%-d"; }
  get_year()  { date -d "$1" +"%Y"; }
  get_month_num() { date -d "$1" +"%-m"; }
fi

CURRENT_YEAR=$(date +"%Y")
CURRENT_MONTH=$(date +"%-m")

START_TAPS=$(( ($(get_year "$START_DATE") - CURRENT_YEAR) * 12 + ($(get_month_num "$START_DATE") - CURRENT_MONTH) ))
END_TAPS=$(( ($(get_year "$END_DATE") - CURRENT_YEAR) * 12 + ($(get_month_num "$END_DATE") - CURRENT_MONTH) ))

if [ "$PLATFORM" = "ios" ]; then
  maestro test --config .maestro/config.yaml "$@" \
    -e TEST_EMAIL="$TEST_EMAIL" \
    -e TEST_PASSWORD="$TEST_PASSWORD" \
    -e TRIP_NAME="${TRIP_NAME:-E2E-Trip-$UNIQUE_ID}" \
    -e PACK_NAME="${PACK_NAME:-E2E-Pack-$UNIQUE_ID}" \
    -e APP_ID="${APP_ID:-com.andrewbierman.packrat.preview}" \
    -e START_YEAR="$(get_year "$START_DATE")" \
    -e START_MONTH="$(get_month "$START_DATE")" \
    -e START_DAY="$(get_day "$START_DATE")" \
    -e START_TAPS="$START_TAPS" \
    -e END_YEAR="$(get_year "$END_DATE")" \
    -e END_MONTH="$(get_month "$END_DATE")" \
    -e END_DAY="$(get_day "$END_DATE")" \
    -e END_TAPS="$END_TAPS" \
    -e TODAY_DATE="$TODAY_DATE" \
    .maestro/master-flow.yaml
else
  maestro test --config .maestro/config-android.yaml "$@" \
    -e TEST_EMAIL="$TEST_EMAIL" \
    -e TEST_PASSWORD="$TEST_PASSWORD" \
    -e TRIP_NAME="${TRIP_NAME:-E2E-Trip-$UNIQUE_ID}" \
    -e PACK_NAME="${PACK_NAME:-E2E-Pack-$UNIQUE_ID}" \
    -e APP_ID="${APP_ID:-com.packratai.mobile.preview}" \
    -e START_YEAR="$(get_year "$START_DATE")" \
    -e START_MONTH="$(get_month "$START_DATE")" \
    -e START_DAY="$(get_day "$START_DATE")" \
    -e START_TAPS="$START_TAPS" \
    -e END_YEAR="$(get_year "$END_DATE")" \
    -e END_MONTH="$(get_month "$END_DATE")" \
    -e END_DAY="$(get_day "$END_DATE")" \
    -e END_TAPS="$END_TAPS" \
    .maestro/master-flow-android.yaml
fi