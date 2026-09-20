#!/usr/bin/env bash
# Runs both test suites and records what they actually reported into data/test-report.json.
# /proof reads this file and shows when it ran. Nothing on that page is a number nobody measured.
set -uo pipefail
cd "$(dirname "$0")/.."
out=data/test-report.json
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

ts_log=$(NODE_OPTIONS=--max-old-space-size=2048 pnpm -r test 2>&1)
ts_total=$(printf '%s' "$ts_log" | grep -oE "Tests  [0-9]+ passed" | grep -oE "[0-9]+" | paste -sd+ | bc)
ts_failed=$(printf '%s' "$ts_log" | grep -coE "Tests .*[0-9]+ failed" || true)

sol_log=$(cd contracts && forge test --summary 2>&1)
sol_total=$(printf '%s' "$sol_log" | grep -oE "^Suite result: ok\. [0-9]+ passed" | grep -oE "[0-9]+" | paste -sd+ | bc)
sol_failed=$(printf '%s' "$sol_log" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" | paste -sd+ | bc)

finished=$(date -u +%Y-%m-%dT%H:%M:%SZ)
commit=$(git rev-parse HEAD)

cat > "$out" <<JSON
{
  "startedAt": "$started",
  "finishedAt": "$finished",
  "commit": "$commit",
  "typescript": { "passed": ${ts_total:-0}, "suitesWithFailures": ${ts_failed:-0}, "command": "pnpm -r test" },
  "solidity": { "passed": ${sol_total:-0}, "failed": ${sol_failed:-0}, "command": "forge test" }
}
JSON
echo "wrote $out"
cat "$out"
