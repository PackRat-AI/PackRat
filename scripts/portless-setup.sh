#!/usr/bin/env bash
#
# One-time-per-host portless setup for the 50+ parallel-agent workflow.
# Idempotent — safe to re-run.
#
# Two rules this script encodes, learned the hard way (see docs/plans U1 spike):
#   1. The proxy MUST run as the SAME user that runs the dev servers. A root-owned
#      proxy (e.g. from `sudo portless proxy start`) uses root's ~/.portless state,
#      which is disjoint from the user's — so it answers requests but 404s every
#      backend your dev servers register. NEVER `sudo portless proxy start`.
#   2. portless 0.13.1 hardcodes a sudo elevation for :443 and IGNORES the
#      cap_net_bind_service capability. So plain setcap does NOT buy you a no-sudo
#      :443 with this version (the cap works for node generally — portless just
#      doesn't use it). Pick a port strategy below.
#
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "On macOS: run 'portless trust', then start the proxy as your user."
  echo "Do not run the proxy under sudo (state split-brain → 404s)."
fi

# 1. Trust the portless local CA so browsers accept its HTTPS certs.
#    This (writing the system trust store) is the only step that may prompt for sudo.
echo "→ trusting portless local CA"
portless trust

# 2. Port strategy — choose one:
#
#    (a) DEFAULT, no sudo: let portless run a user-owned proxy on :1355.
#        Fully solves port collisions for parallel agents; URLs carry ':1355'.
#        Just run `portless` / `portless run` — it falls back to :1355 automatically.
#
#    (b) Clean :443 URLs: requires sudo at proxy start AND must stay user-context.
#        Use ONE of these (do not use a bare `sudo portless proxy start` — that
#        split-brains as root):
#          sudo -E portless proxy start    # -E preserves HOME so it shares ~/.portless
#          # or scope a passwordless-sudo rule to `portless proxy start`
#          # or: portless service install  (verify the service runs as your user)
#
# (Optional) capability for node — harmless, lets node itself bind low ports, and
# future portless versions may honor it. Does NOT give portless 0.13.1 no-sudo :443.
#   NODE_BIN="$(readlink -f "$(command -v node)")"
#   sudo setcap 'cap_net_bind_service=+ep' "$NODE_BIN"
#   # NOTE: mise moves the node binary on version bumps, dropping this — re-run then.

echo "✓ portless CA trusted. Start dev with: portless   (user-owned :1355 by default)"
echo "  For clean :443 URLs, see option (b) in this script."
