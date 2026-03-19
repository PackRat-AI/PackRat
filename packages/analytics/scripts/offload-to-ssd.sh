#!/usr/bin/env bash
#
# Offload heavy analytics directories to external SSD and symlink back.
# Frees internal disk space while keeping everything working transparently.
#
# Usage:
#   ./scripts/offload-to-ssd.sh           # move data + node_modules to SSD
#   ./scripts/offload-to-ssd.sh --restore # move everything back to internal
#   ./scripts/offload-to-ssd.sh --status  # show what's offloaded
#
set -euo pipefail

SSD_VOLUME="/Volumes/CrucialX10"
SSD_BASE="$SSD_VOLUME/andrewbierman/Code/packrat-analytics-offload"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Directories to offload (relative to package root)
OFFLOAD_DIRS=(
  "data/cache"
  "node_modules"
)

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[0;90m%s\033[0m\n' "$*"; }

check_ssd() {
  if [ ! -d "$SSD_VOLUME" ]; then
    red "Error: External SSD not mounted at $SSD_VOLUME"
    echo "Plug in the drive and try again."
    exit 1
  fi
}

offload_dir() {
  local rel_path="$1"
  local src="$PKG_DIR/$rel_path"
  local dest="$SSD_BASE/$rel_path"

  if [ -L "$src" ]; then
    dim "  $rel_path — already symlinked, skipping"
    return 0
  fi

  if [ ! -d "$src" ]; then
    dim "  $rel_path — doesn't exist, skipping"
    return 0
  fi

  local size
  size=$(du -sh "$src" 2>/dev/null | cut -f1)

  echo "  Moving $rel_path ($size) → SSD..."
  mkdir -p "$(dirname "$dest")"

  # Use rsync for safe copy, then swap
  rsync -a --delete "$src/" "$dest/"
  rm -rf "$src"
  ln -s "$dest" "$src"

  green "  $rel_path — offloaded ($size freed)"
}

restore_dir() {
  local rel_path="$1"
  local src="$PKG_DIR/$rel_path"
  local dest="$SSD_BASE/$rel_path"

  if [ ! -L "$src" ]; then
    dim "  $rel_path — not a symlink, skipping"
    return 0
  fi

  if [ ! -d "$dest" ]; then
    red "  $rel_path — symlink target missing on SSD!"
    return 1
  fi

  local size
  size=$(du -sh "$dest" 2>/dev/null | cut -f1)

  echo "  Restoring $rel_path ($size) ← SSD..."
  rm "$src"
  rsync -a --delete "$dest/" "$src/"
  rm -rf "$dest"

  green "  $rel_path — restored to internal disk"
}

show_status() {
  echo "Package: $PKG_DIR"
  echo ""
  for rel_path in "${OFFLOAD_DIRS[@]}"; do
    local src="$PKG_DIR/$rel_path"
    if [ -L "$src" ]; then
      local target
      target=$(readlink "$src")
      local size
      size=$(du -sh "$target" 2>/dev/null | cut -f1 || echo "?")
      green "  $rel_path → $target ($size, on SSD)"
    elif [ -d "$src" ]; then
      local size
      size=$(du -sh "$src" 2>/dev/null | cut -f1)
      dim "  $rel_path — local ($size, on internal disk)"
    else
      dim "  $rel_path — not present"
    fi
  done
  echo ""
  echo "Internal: $(df -h /Users/andrewbierman | tail -1 | awk '{print $4}') free"
  echo "SSD:      $(df -h "$SSD_VOLUME" | tail -1 | awk '{print $4}') free"
}

case "${1:-}" in
  --restore)
    check_ssd
    echo "Restoring from SSD..."
    for dir in "${OFFLOAD_DIRS[@]}"; do
      restore_dir "$dir"
    done
    echo ""
    green "Done. $(df -h /Users/andrewbierman | tail -1 | awk '{print $4}') free on internal disk."
    ;;
  --status)
    check_ssd
    show_status
    ;;
  *)
    check_ssd
    echo "Offloading to $SSD_BASE ..."
    for dir in "${OFFLOAD_DIRS[@]}"; do
      offload_dir "$dir"
    done
    echo ""
    green "Done. $(df -h /Users/andrewbierman | tail -1 | awk '{print $4}') free on internal disk."
    ;;
esac
