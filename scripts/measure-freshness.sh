#!/usr/bin/env bash
# V3-01 acceptance: first-paint data-asof age on every live route, as a visitor gets it.
# Usage: measure-freshness.sh <samples> <interval-sec>  -> data/freshness/<stamp>.tsv
set -euo pipefail
cd "$(dirname "$0")/.."
n=${1:-10}; every=${2:-180}
out="data/freshness/$(date -u +%Y%m%dT%H%M%SZ).tsv"
echo -e "at\troute\tage_sec" > "$out"
routes="/ /board /credit /proof /methodology /asset/BRK.Bx /asset/HKEXCx"
for i in $(seq "$n"); do
  for r in $routes; do
    now=$(date -u +%s)
    asof=$(curl -s --max-time 10 "https://www.usekerb.xyz$r" | grep -o 'data-asof="[^"]*"' | head -1 | cut -d'"' -f2 || true)
    if [ -n "$asof" ]; then age=$(( now - $(date -u -d "$asof" +%s) )); else age=NA; fi
    echo -e "$(date -u +%FT%TZ)\t$r\t$age" >> "$out"
  done
  [ "$i" -lt "$n" ] && sleep "$every"
done
echo "$out"
