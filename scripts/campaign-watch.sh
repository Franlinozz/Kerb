#!/usr/bin/env bash
# Verify the collector is healthy every 30 minutes across the campaign-end window, and record
# each check. It reads /health and the store. It never restarts anything: the whole point of the
# window is that the record is continuous through it.
set -uo pipefail
cd "$(dirname "$0")/.."
log=data/campaign/watch.log
mkdir -p data/campaign
until [ "$(date -u +%H%M)" \> "0900" ]; do
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  health=$(curl -s -m 20 http://127.0.0.1:8710/health | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    stale=[s for s in d['sources'] if s['stale']]
    ages=[s['ageSec'] for s in d['sources']]
    print(f\"status={d['status']} sources={len(d['sources'])} stale={len(stale)} maxAge={max(ages) if ages else 'na'}s\")
except Exception as e:
    print(f'health unreadable: {e}')
")
  rows=$(sudo -u postgres psql -d kerb -At -c "select count(*) from obs_pool_state where ts > now() - interval '30 min';" 2>/dev/null || echo "?")
  gap=$(sudo -u postgres psql -d kerb -At -c "select coalesce(to_char(max(d),'HH24:MI:SS'),'none') from (select ts - lag(ts) over (order by ts) d from obs_pool_state where ts > now() - interval '30 min') x;" 2>/dev/null || echo "?")
  line="$now  $health  poolRows30m=$rows  largestGap30m=$gap"
  echo "$line" | tee -a "$log"
  sleep 1800
done
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)  window complete" | tee -a "$log"
