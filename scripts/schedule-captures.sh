#!/usr/bin/env bash
# Capture the engine state at named UTC times, so a market-time transition is measured on both
# sides of it rather than reconstructed afterwards. Read-only: it never touches the collector.
#
#   ./scripts/schedule-captures.sh 1315:us-preopen 1415:us-open-plus-45
set -uo pipefail
cd "$(dirname "$0")/.."
for spec in "$@"; do
  hhmm="${spec%%:*}"
  label="${spec##*:}"
  echo "$(date -u +%H:%M)  waiting for ${hhmm} UTC to capture '${label}'"
  while [ "$(date -u +%H%M)" -lt "$hhmm" ]; do sleep 60; done
  ./scripts/window-snapshot.sh "$label"
done
echo "$(date -u +%H:%M)  all scheduled captures done"
