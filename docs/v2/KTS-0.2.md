# KTS-0.2
## Horizon-bound margins

Amends KTS-0.1 section 7.4 only. Everything else in KTS-0.1 (regime machine, depth, mark, liquidity capacity, position capacity, covenant, reproducibility, guardrails) is unchanged.

Status: proposed for Kerb engine, decision gate Tue 22 Sep 2026 18:00 UTC.

---

## 1. Why

Under 0.1, `carryLTV = min(stressLTV(H_weak), LT - carryMargin)` with a constant `carryMargin` of 0.10, and likewise Session Max with 0.05. For every tracked asset `stressLTV` is far above `LT` (a 99th percentile gap of a few percent is small next to a 65% threshold), so the constant margin always binds. The result, visible in every terms history: Carry and Session Max never move with the session, and the gap between them is a fixed five points.

The idea of Kerb is that credit follows market time. 0.2 makes the margin below the fixed liquidation line depend on the horizon each mode has to survive.

## 2. Rule

```
gWeak = g(a, H_weak)          // 99th percentile |log move| over the horizon to the next deep window
gCure = g(a, H_cure)          // same, over the horizon to the next cure deadline
v     = volScaler(a)          // unchanged from 0.1
s     = impact at referenceLiquidationSize from the Depth ladder, current regime

carryMargin   = max(minCarryMargin,   k * v * gWeak + s)
sessionMargin = max(minSessionMargin, k * v * gCure + s)

carryLTV      = clamp(LT - carryMargin,   ltvMin, ltvMax)
sessionMaxLTV = clamp(LT - sessionMargin, ltvMin, ltvMax), then max(sessionMaxLTV, carryLTV), then min(sessionMaxLTV, LT)
```

Reading it in one sentence: **a Carry position can take k times the stressed price gap between now and the next deep market, plus the cost of exiting, without crossing the fixed liquidation line.** Session Max makes the same promise only up to the cure deadline, which is why it carries the covenant.

`LT` is still fixed per asset and timelocked. 0.2 never changes it.

## 3. Parameters (new, versioned in the bundle)

| Name | Value | Meaning |
|---|---|---|
| `kts` | `"0.2"` | Formula version |
| `capacity.stressMultiplier` (`k`) | `2.5` | Multiplier over the empirical 99th percentile gap, covering model error, correlated moves and the gap between quantile and tail |
| `capacity.minCarryMargin` | `0.05` | Floor on the Carry margin |
| `capacity.minSessionMargin` | `0.03` | Floor on the Session Max margin |

`carryMargin` and `sessionMargin` from 0.1 remain in the parameter file for 0.1 bundles and are ignored by 0.2.

## 4. What it does to the numbers (illustrative, not measured)

For a blue chip with `LT 0.65`, `v 0.78`, `s 0.005`:

| Moment | H_weak | g(H_weak) | H_cure | g(H_cure) | Carry | Session Max |
|---|---|---|---|---|---|---|
| Tuesday midday | ~17 h | 3.2% | ~5 h | 1.8% | ~58.3% | ~61.0% |
| Friday 18:00 UTC | ~67.5 h | 6.5% | ~1 h | 1.0% | ~51.8% | ~62.0% |
| Monday after open | stepped up by `maxLoosenStep` per post until converged | | | | | |

The shape is the point: before a long closure Carry tightens and the gap to Session Max widens; midweek they converge; after the reopen, loosening is visibly stepped by the existing asymmetry. Real values come from the engine and are labelled Computed.

## 5. Report additions

The report's `capacity` object gains a `margins` block so the UI can explain the ladder:

```json
"margins": {
  "kts": "0.2",
  "stressMultiplier": "2.5",
  "carry":   { "gap": "0.065", "volScaler": "0.78", "exitCost": "0.005", "raw": "0.13175", "floor": "0.05", "used": "0.13175", "horizonHours": "67.5", "horizonEndsAt": "2026-09-28T13:30:00Z" },
  "session": { "gap": "0.010", "volScaler": "0.78", "exitCost": "0.005", "raw": "0.0245",  "floor": "0.03", "used": "0.03",    "horizonHours": "1.0",  "horizonEndsAt": "2026-09-25T20:00:00Z" }
}
```

The API exposes it on `/v1/report/:chain/:asset` and a compact form on `/v1/board` rows.

## 6. Compatibility

- **Onchain:** no contract change. New values stay inside each asset's existing guardrails (`ltvMax = LT`). Loosening is already bounded by `maxLoosenStepBps` and `loosenCooldownSec` in `KerbTerms`; the engine's asymmetry (`maxLoosenStep 0.02`, `recoveryCooldownSec 1800`, `nConfirm 3`) must stay at or inside those bounds so no post reverts.
- **Reproducibility:** `kerb verify` reads `kts` from the bundle and dispatches to the matching capacity function. 0.1 bundles recompute under 0.1 forever. The 0.1 code path is kept, not deleted.
- **Credit plane:** the testnet relay posts the mainnet mirror terms as today. Existing positions keep their recorded `carryTarget`; the cure target is `min(carryTarget, current carryLTV)` as specified in 0.1, so a tighter Carry before a weekend can enlarge a cure but never moves the liquidation line.

## 7. Acceptance

1. Unit tests: table-driven margins for at least six horizon cases; floors bind when gaps are tiny; `carry <= session <= LT` always.
2. Replay: run the 0.2 capacity over every stored 0.1 bundle from the last 72 h and chart Carry and Session Max. Values must differ across regimes and never breach guardrails.
3. Fork test: post the replayed 0.2 series through `KerbTerms` on an X Layer mainnet fork in time order; zero reverts.
4. `kerb verify` passes on one 0.1 and one 0.2 bundle.
5. Live: after deployment, at least one pair of consecutive mainnet posts across a regime change shows a different Carry.

## 8. Rollback

If any acceptance item is red at the decision time, the engine stays on 0.1, the 0.2 branch is not merged, and the UI and README say plainly: "In KTS-0.1 the Carry to Session Max margin is fixed. What moves with market time is the debt ceiling, through measured depth, and the cure deadline." No claim that LTVs move may appear anywhere in that case.
