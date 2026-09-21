#!/usr/bin/env bash
# Public copy carries no em dash (U+2014), in any spelling. AGENTS.md section 12.4, rule 7.
set -euo pipefail
cd "$(dirname "$0")/.."
hits=$(git ls-files -z -- \
  'README.md' 'SECURITY.md' 'AGENTS.md' 'BUILD_PERIOD.md' 'PROJECT_STATE.md' 'docs/**' \
  'apps/web/src/**' 'apps/api/src/**' 'apps/engine/src/**' 'packages/*/src/**' \
  | xargs -0 grep -nE $'—|&mdash;|&#8212;|\\\\u2014' 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "Em dash found in public copy. Use a colon, comma or full stop instead:"
  echo "$hits"
  exit 1
fi
echo "copy check: no em dashes"
