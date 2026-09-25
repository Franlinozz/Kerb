# Final audit, Kerb v3.0.0 (V3-CRUCIBLE.md)

Run 25 Sep 2026, 02:20 to 03:00 UTC, against production. Evidence files are in `data/release/crucible-2026-09-25/` unless another path is given. A cold ten-minute re-check runs before submitting.

| Section | Result | Evidence |
|---|---|---|
| A. Eligibility | Pass (video pending) | `checks.txt`: apex, www, repo logged out, API all 200. Remote and Build a Market stated in README, RELEASE_STATE and the form draft. Video: operator, Fri 07:30 UTC |
| B. Freshness | Pass | `freshness.idle.spec.ts` passed on the live build; with the warmer, first-paint median age 14.5 to 25.5 s per route over 70 loads (max 47 s) (`data/freshness/20260925T025055Z.tsv`); no raw enum in any DOM (E2E regex) |
| C. Golden path | Pass | Production, fresh wallets, every receipt success: `data/credit-flow-2026-09-23.json` |
| D. Keeper | Pass, rung 1 | `data/keeper.log`: cycles with tx hashes since 23 Sep; stranger cure `0x5468b5ed…` (`data/keeper-cure-2026-09-23.json`); refuses chains other than 1952 (`apps/attester/test`); kKOx fallback opened `0x2d40ac96…edae` at 02:49 UTC |
| E. X Layer | Pass | `/health`: last mainnet post 02:39 UTC; Builder Code decoded on /proof; 34 of 34 Sourcify exact match; `kerbquote-kox-25.txt`: KerbQuote 992393683 equals the API figures |
| F. OKX DEX | Pass | `/v1/exit/196/*` healthy with quote age; `exit-conservative.txt`: 6,342 of 6,342 checks follow the rule (smaller figure beyond 25% difference, else the tick-walk) |
| G. OKX.AI and agents | Pass at rung 2; listing under review | `checks.txt`: 402 with `PAYMENT-REQUIRED`; MCP `tools/list` returns six tools; first mainnet settlement `0xb0befc3e…e982e`; agent #13887 registered (`0x942ea858…58e6`), listing submitted, under review; no settlement on a forced 503 and 429 with a plain reason (`apps/agents/test/app.test.ts`) |
| H. Attribution | Pass | Golden and additive-split tests (`apps/api/test/attribution.golden.test.ts`, engine tests: 106 passed); no `{` placeholder in DOM (E2E) |
| I. Proof and research | Pass | `kerb-verify-stranger.txt` and `kerb-verify-tx.txt`: posts from the last hour reproduce with no database; no "pinned" claim (claims-check); Report #1 unchanged; Report #2 partial with gaps shown, final 07:15 UTC; dataset served at `/v1/datasets/*` |
| J. Frontend | Pass | `docs/media/screens/` (1440 Night and Day), `data/screens/v3/final` (108 screens, 24 Sep); E2E: no route scrolls sideways at 390 |
| K. Quality | Pass | CI green on `main`; 594 TS and 120 Solidity tests, 0 failing (`data/test-report.json`); 79 E2E; axe 34 of 34 on live; dead-button sweep 0 of 340 (24 Sep); `secret-scan.txt`: 0 of 11 live secret values in full history; em dash check and claims-check clean. Lighthouse mobile: 85+ on every route on 24 Sep; Home 70 to 81 in runs on 25 Sep on the shared host |
| L. Repository | Pass | README rebuilt (system diagram, screens, evidence), `docs/release/*` updated, every public claim has a `CLAIM_EVIDENCE.md` row |
| M. Demo | Pending | Operator films Fri; shot list, fallbacks and Last Call times in `DEMO_VERIFICATION.md` |
| N. Submission | Pending | `SUBMISSION_CHECKLIST.md`, `docs/v3/V3-SUBMISSION.md` |

## Fixed during certification

- `kerb verify` required Kerb's database: a stranger could not run it. Now it reads the bundle from the API (checked by hash) and the posted values from KerbTerms on chain, latest or by `--tx`.
- The demo keeper had opened nothing since 24 Sep 09:04 UTC: HKEXCx Carry and Session Max were equal after its Stale period. It now falls back to kKOx.
- `/v1/agents/stats` counted four facilitator-reported calls with no settlement transaction as settled; Home said "5 paid calls settled". It now counts only calls with a transaction and reports the others as unconfirmed.
- Research #2 headline figures led with the cliff and disagreed with the Home KPI; both now lead with the 08:30 UTC finding.
- `/proof` could read "last post Refreshing ago" when two reads disagreed by a second; ages are clamped at zero.

## Verdict

```
CRUCIBLE RELEASE VERDICT, Kerb v3.0.0
Golden path:            VERIFIED
Freshness:              VERIFIED
Keeper:                 rung 1 (standing position every cycle, kKOx fallback)
Agents:                 rung 2, listing under review, first mainnet settlement 0xb0befc3e64d4ba3e62bd2ab0b5be95ca720a1b2b787df0c6f6cf075a314e982e
Onchain consumers:      rung 1 (KerbQuote and ten KerbMarkFeed on mainnet, Sourcify exact match)
Report #2:              rung 1 (published, final regeneration Fri 07:15 UTC)
Critical blockers:      0
Completion score:       93/100 (video and submission outstanding)
Win readiness:          90/100
Recommendation:         SHIP
Remaining risks:        OKX.AI review may not finish before judging; Hong Kong Last Call on the Board depends on the live regime at 07:30 UTC (fallbacks in DEMO_VERIFICATION.md); Lighthouse variance on the shared host
```
