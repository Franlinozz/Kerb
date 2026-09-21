#!/usr/bin/env bash
# Capture the full engine state for every asset at a moment in time, for the campaign-end
# before/after comparison. Reads only; it never touches the collector.
set -uo pipefail
cd "$(dirname "$0")/.."
label="${1:-snapshot}"
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
out="data/windows/${label}-${stamp}.json"
assets=$(python3 -c "import json;d=json.load(open('config/assets.json'));print(' '.join(a['symbol'] for a in d['assets'] if a.get('status')=='resolved'))")
echo "{" > "$out"
echo "  \"label\": \"${label}\"," >> "$out"
echo "  \"capturedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$out"
echo "  \"assets\": {" >> "$out"
first=1
for a in $assets; do
  body=$(curl -s -m 60 "http://127.0.0.1:8720/v1/report/196/${a}")
  [ -z "$body" ] && body='{"error":"no response"}'
  [ $first -eq 0 ] && echo "," >> "$out"
  first=0
  printf '    "%s": %s' "$a" "$body" >> "$out"
done
echo "" >> "$out"
echo "  }" >> "$out"
echo "}" >> "$out"
# Pool balances belong to the same moment as the engine snapshot, so capture both together.
(cd "$(pwd)" && node --env-file="${KERB_ENGINE_ENV_FILE:-/root/.kerb/attester-mainnet.env}" --import tsx apps/engine/scripts/pool-balances.ts "$label" 2>&1 | tail -1) || echo "  (pool balances not captured)"

python3 -c "
import json,sys
d=json.load(open('$out'))
ok=[k for k,v in d['assets'].items() if 'error' not in v]
print('captured', len(ok), 'of', len(d['assets']), 'assets ->', '$out')
for k in ok:
    v=d['assets'][k]
    print(f\"  {k:8} regime {v['regime']:18} C(1%) {v['depth']['C_1']:>14} mark {v['mark']['creditMark'][:12]:>14} carry {v['capacity']['carryLTV']}\")
"
