#!/usr/bin/env bash
# import.sh — Import OSM hiking data into Neon PostgreSQL
#
# Prerequisites:
#   - osm2pgsql >= 1.9 (flex output, Lua style files)
#   - NEON_DATABASE_URL set (postgresql://...)
#   - Drizzle migration 0037 already applied (PostGIS enabled, tables exist)
#
# Usage:
#   ./import.sh [path/to/region.osm.pbf]
#
# If no PBF is supplied the script downloads Utah (~150 MB) from Geofabrik —
# a good size for local POC testing without the full North America extract.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LUA_CONFIG="${SCRIPT_DIR}/routes.lua"

# ── Database URL ────────────────────────────────────────────────────────────

DB_URL="${NEON_DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  echo "Error: NEON_DATABASE_URL is not set" >&2
  exit 1
fi

# ── PBF file ─────────────────────────────────────────────────────────────────

if [[ -n "${1:-}" ]]; then
  PBF_FILE="$1"
  if [[ ! -f "$PBF_FILE" ]]; then
    echo "Error: file not found: $PBF_FILE" >&2
    exit 1
  fi
else
  PBF_FILE="${SCRIPT_DIR}/utah-latest.osm.pbf"
  if [[ ! -f "$PBF_FILE" ]]; then
    echo "Downloading Utah extract from Geofabrik (~150 MB)..."
    curl -L --progress-bar \
      -o "$PBF_FILE" \
      "https://download.geofabrik.de/north-america/us/utah-latest.osm.pbf"
  fi
fi

echo "PBF file: $PBF_FILE"
echo "Lua config: $LUA_CONFIG"
echo ""

# ── Import ───────────────────────────────────────────────────────────────────
#
# Flags:
#   --slim          store node/way/relation data in DB for future updates
#   --drop          drop slim tables after import (saves space for one-shot POC)
#   -O flex         use Lua flex output
#   -S hiking.lua   our style file
#   -d <url>        connection string
#
# For subsequent imports (adding more regions) replace --create with --append.

echo "Starting osm2pgsql import..."
osm2pgsql \
  --slim \
  --drop \
  --create \
  -O flex \
  -S "$LUA_CONFIG" \
  -d "$DB_URL" \
  "$PBF_FILE"

echo ""
echo "Import complete."
echo ""
echo "Verify row counts:"
psql "$DB_URL" -c "SELECT sport, count(*) FROM osm_ways GROUP BY sport ORDER BY sport; SELECT sport, count(*) FROM osm_routes GROUP BY sport ORDER BY sport;"
