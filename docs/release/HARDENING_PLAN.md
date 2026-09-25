# Hardening plan

The H items from `docs/v2/V2-AUDIT.md` section 8, each with its pass condition and status on 22 Sep 2026.

| Item | Pass condition | Status |
|---|---|---|
| H-01 KTS-0.2 | Carry and Session Max differ by regime in live posts; no revert in a replay; verify passes for 0.1 and 0.2 | Done 21 Sep: live on mainnet and testnet; replay and fork evidence in `data/reports/kts-0.2-*` |
| H-02 Repo hygiene | Root holds only README, LICENSE, AGENTS.md, SECURITY.md, config and code | Done (V2-00); planning under `docs/planning/`, private notes out of the tree |
| H-03 Kerbstone foundation | One product at 390, 768, 1440 in both themes | Done; `data/screens/v2/final-22sep` |
| H-04 Wallet layer | Rejecting a connection shows "Connection cancelled", nothing raw | Done; E2E `shell.spec.ts` (EIP-6963 mock), plus wrong-network switch |
| H-05 Judge onboarding | A fresh wallet reaches a Session Max borrow with no outside instructions | Done; four real browser runs with fresh wallets, one keyboard only |
| H-06 Demo clock on Credit | Rail is the demo cycle and matches `cureStatus` | Done; Last Call panel appeared on every run exactly when the rail's window opened |
| H-07 Curable feed and demo position | Any visitor can press Cure within an hour | Done: keeper live since 23 Sep; kKOx fallback since 25 Sep 02:48 UTC |
| H-08 Home | A stranger states what Kerb is in 10 seconds | Done (V2-06 test) |
| H-09 Video | 2:50 to 3:30, real, captioned | Operator, Fri 25 Sep (`docs/v3/V3-DEMO.md`, `DEMO_VERIFICATION.md`) |
| H-10 Session Rail | No dash, no stale countdown, labels under the right day | Done; E2E across a mocked transition |
| H-11 Board | Risk differences scannable in 5 s | Done |
| H-12 Asset page | The thesis visible as a picture | Done; terms history with regime bands |
| H-13 Research | Report #2 by Thu 20:00 UTC | Done: published partial 24 Sep, final Fri 07:15 UTC |
| H-14 Methodology | No value off-screen at any width | Done; E2E at 390 and 1440 |
| H-15 Proof | No bare "no" | Done; E2E; all 34 contracts Sourcify exact match |
| H-16 Mirror LT | Explained or aligned | Explained on `/credit` drawer, `/proof`, API disclaimer |
| H-17 CI and E2E | Green badge | Done; E2E a required job against recorded real responses |
| H-18 Metadata | Link unfurls as Kerb with art | Done 22 Sep: social cards carry each page's plate |

## V3 items (25 Sep 2026)

| Item | Pass condition | Status |
|---|---|---|
| Freshness (V3 S0) | First paint fresh or Refreshing after idle; median age under 30 s with the warmer | Done; `freshness.idle.spec.ts` on live; `data/freshness/` |
| Honest counts | No settled claim without a transaction | Done 25 Sep: `/v1/agents/stats` counts only calls with a settlement tx |
| Stranger verification | `kerb verify` with no database reproduces a live post | Done 25 Sep; `data/release/crucible-2026-09-25/kerb-verify-*.txt` |
| Conservative exit | Selection rule holds on every mainnet check | Done: 6,342 of 6,342 |
| Keeper availability | A curable position every demo Last Call | Done: kKOx fallback when HKEXCx has no room |
| Secret hygiene | No live secret in any commit | Done: 0 of 11 values in full history |
| Accessibility | Axe 0 serious or critical, both themes | Done on live, 34 of 34 |
| Navigation and onboarding | Every doc reachable in two clicks; tour works end to end | Done: Developers and Docs menus, E2E; tour E2E incl. closing card |
| Evaluator access | Machine-readable map of the project | Done: `/llms.txt`, sitemap, robots |
