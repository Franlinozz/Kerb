#!/usr/bin/env bash
# Public copy makes no claim the evidence does not support. docs/v3/V3-LIVE-AUDIT.md L-04 and
# AGENTS.md 13.7. Historical plans (docs/v2, docs/v3, the master plan) are exempt: they record
# what was believed at the time. Field names such as pinStatus or "unpinned" are not claims, so
# every pattern below is a phrase, not a bare word.
set -euo pipefail
cd "$(dirname "$0")/.."
deny=(
  'pinned (input )?bundle'          # bundles are published and API-served; IPFS pinning is paused
  'pinned in a bundle'
  'bundled \+ pinned'
  'from pinned inputs'
  'currently private'               # the repository is public
  'identical collateral'            # overbroad; see V3-POSITIONING.md section 4
  'treat (all|every) (of those )?moments? as identical'
  'USDG as the loan asset'          # mainnet terms are denominated in USDG; testnet lends mUSDG
  'loan asset is USDG'
  'loan asset on mainnet'
  'no approved (master|image)'      # The Seal was approved and placed 22 Sep
  'keeps the geometric Kerbstone'
  'real-time'                       # say "every few minutes"
  'AI-powered'
  'autonomous underwriting'
  'trustless'
  'institutional-grade'
  'Chainlink-powered'
  'integrated by lenders'
)
pattern=$(IFS='|'; echo "${deny[*]}")
hits=$(git ls-files -z -- 'README.md' 'SECURITY.md' 'docs/**' 'apps/web/src/**' 'apps/api/src/**' \
  ':!:docs/v2/**' ':!:docs/v3/**' ':!:docs/planning/KERB-MASTER-PLAN.md' ':!:docs/planning/BUILD_PLAN.md' \
  | xargs -0 grep -niE "$pattern" 2>/dev/null \
  | grep -vF 'Produced by KTS-0.1 from the pinned input bundle' || true)
# The one exemption above is the engine's report provenance note, quoted in docs/API.md captures.
# It is part of every posted report's byte-identical recompute (apps/engine/test/recompute.test.ts),
# so it is frozen; the UI and docs describe bundles as published instead.
if [ -n "$hits" ]; then
  echo "Claim without evidence found in public copy (docs/v3/V3-LIVE-AUDIT.md L-04):"
  echo "$hits"
  exit 1
fi
echo "claims check: ${#deny[@]} denied phrases, none found"
