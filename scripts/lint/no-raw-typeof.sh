#!/usr/bin/env bash
#
# no-raw-typeof.sh — enforces using @packrat/guards instead of raw typeof checks.
#
# Flags any code outside of @packrat/guards itself that uses
#   typeof x === 'string' | 'number' | 'boolean' | 'function' | 'object' |
#              'undefined' | 'symbol' | 'bigint'
# (or the !== counterpart). The guard package is the canonical place for
# primitive narrowing — everything else should import isString/isNumber/etc.
#
# Exit code:
#   0 — no violations
#   1 — violations found (details printed to stdout)
#
# Wired into `bun lint:strict`. Not yet in default CI while the backlog
# is worked down.

set -euo pipefail

cd "$(dirname "$0")/../.."

# POSIX extended regex used by `grep -E`.
PATTERN='typeof[[:space:]]+[A-Za-z_][A-Za-z0-9_.]*[[:space:]]*(===|!==)[[:space:]]*('"'"'|")(string|number|boolean|object|function|undefined|symbol|bigint)('"'"'|")'

# Directories to walk.
ROOTS=("apps" "packages")

# Excludes:
#   - packages/guards/**         — the guard implementation itself
#   - **/node_modules/**         — third-party code
#   - **/dist/**, **/build/**    — build output
#   - *.test.* / *.spec.*        — test files are out of scope for this rule
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

find "${ROOTS[@]}" \
  \( -path '*/node_modules' -o -path '*/dist' -o -path '*/build' -o -path 'packages/guards' \) -prune -o \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.cts' -o -name '*.mts' \) -type f \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -name '*.spec.ts' ! -name '*.spec.tsx' \
  -print0 2>/dev/null \
  | xargs -0 grep -EnH "$PATTERN" 2>/dev/null > "$tmp" || true

if [ -s "$tmp" ]; then
  count=$(wc -l < "$tmp" | tr -d ' ')
  echo "Raw typeof checks found ($count) — use @packrat/guards (isString, isNumber, isBoolean, isFunction, isObject) instead:"
  echo ""
  cat "$tmp"
  exit 1
fi

echo "No raw typeof checks in non-test code."
