#!/usr/bin/env bash
#
# no-raw-regex.sh — enforces using magic-regexp instead of raw regex literals
# or `new RegExp(...)` in non-test production code.
#
# The reference implementation lives in packages/analytics/src/core/enrichment.ts.
# Raw regex literals are easy to get wrong (missing escapes, unintended group
# captures, poor readability) and magic-regexp gives us a typed, composable
# builder that's easier to review.
#
# What gets flagged:
#   - `new RegExp(...)` anywhere in apps/ or packages/ (excluding tests)
#   - Any `.replace(/.../)`, `.match(/.../)`, `.test(/.../)`, `.split(/.../)`,
#     `.search(/.../)`, `.replaceAll(/.../)` call — a strong signal of a raw
#     literal being used against a string method.
#
# Note: this is an intentionally coarse grep — it will miss regex literals
# assigned to variables, and it will over-flag a handful of call sites. That's
# fine for a nudge-style rule. Biome's `performance/useTopLevelRegex` covers
# the stricter AST check.
#
# Exit code:
#   0 — no violations
#   1 — violations found (details printed to stdout)

set -euo pipefail

cd "$(dirname "$0")/../.."

ROOTS=("apps" "packages")

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# `new RegExp(...)` + regex literals passed to string methods.
PATTERN='(new[[:space:]]+RegExp[[:space:]]*\()|(\.(replace|replaceAll|match|matchAll|test|split|search)\(/)'

find "${ROOTS[@]}" \
  \( -path '*/node_modules' -o -path '*/dist' -o -path '*/build' \
     -o -path 'packages/analytics/src/core/enrichment.ts' \) -prune -o \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.cts' -o -name '*.mts' \) -type f \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -name '*.spec.ts' ! -name '*.spec.tsx' \
  -print0 2>/dev/null \
  | xargs -0 grep -EnH "$PATTERN" 2>/dev/null > "$tmp" || true

# Filter out the reference implementation (which magic-regexp is allowed in).
# The -prune above covers enrichment.ts by path, so this is defensive only.
sed -i.bak '/packages\/analytics\/src\/core\/enrichment.ts/d' "$tmp" 2>/dev/null || true
rm -f "$tmp.bak"

if [ -s "$tmp" ]; then
  count=$(wc -l < "$tmp" | tr -d ' ')
  echo "Raw regex literals found ($count) — prefer magic-regexp (see packages/analytics/src/core/enrichment.ts for a reference):"
  echo ""
  cat "$tmp"
  exit 1
fi

echo "No raw regex literals in non-test production code."
