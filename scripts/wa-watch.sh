#!/bin/bash
# Continuous watcher: prints a line whenever the watch list, device tokens or
# alert state changes on the isolated Neon branch.
cd "$(dirname "$0")/.."
prev=""
while true; do
  now=$(./scripts/wa-monitor.sh watch 2>/dev/null | tr -d ' \n')
  tok=$(./scripts/wa-monitor.sh tokens 2>/dev/null | tr -d ' \n')
  st=$(./scripts/wa-monitor.sh state 2>/dev/null | tr -d ' \n')
  cur="$now|$tok|$st"
  if [ "$cur" != "$prev" ]; then
    echo "=== $(date '+%H:%M:%S') change ==="
    echo "watch:  $(echo "$now" | head -c 400)"
    echo "tokens: $(echo "$tok" | head -c 300)"
    echo "state:  $(echo "$st" | head -c 400)"
    prev="$cur"
  fi
  sleep 15
done
