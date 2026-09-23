# KTS-0.1
## The Kerb Terms Standard

An open standard for converting observed market conditions into credit capacity for tokenized securities.
Version 0.1. Status: draft, implemented by Kerb. Anyone may implement or verify it.

> Every number produced by KTS must be recomputable from its published input bundle. If a report cannot be recomputed byte for byte, the report is invalid.

---

## 1. Scope

KTS answers one question per asset, continuously:

> **How much debt can this collateral safely support right now, given where it trades, when its underlying market is open, and what can actually be sold into today?**

It does not answer whether an asset is a good investment, whether an issuer is solvent, or whether a token is legally compliant.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Asset** | A tokenized security or commodity on a chain, identified by `chainId:tokenAddress` |
| **Underlying market** | The venue whose session governs the asset's reference price (for example XNYS, XNAS, XHKG, XCOM) |
| **Reference price** | An independent price for the underlying, from an oracle or issuer data source |
| **Pool price** | The price implied by the executable onchain venue state |
| **Credit Mark** | The conservative valuation KTS uses for collateral |
| **Executable depth** `C(i)` | Notional of the asset sellable into onchain venues at price impact no worse than `i` |
| **Regime** | The current liquidity-and-reference state of the asset (Section 4) |
| **Horizon** `H` | Hours until the next window in which deep liquidity is expected to exist |
| **Carry capacity** | Credit that is expected to survive the next weaker regime without borrower action |
| **Session Max capacity** | Credit valid in the current regime, subject to a cure covenant |
| **Coverage ratio** | Executable depth divided by outstanding debt against that asset |

---

## 3. Inputs

A KTS report consumes exactly these inputs, each recorded with source, timestamp and content hash:

1. **Asset profile** from an asset adapter: token address, decimals, wrapper address and type, underlying symbol, underlying market code, corporate-action method, current multiplier.
2. **Calendar** for the underlying market: sessions, holidays, early closes, intraday breaks, timezone and DST rules.
3. **Reference observations**: one or more independent prices with source identifiers and timestamps.
4. **Venue state**: for each onchain venue, the raw state needed to simulate a sale. For Uniswap V3: `slot0` (sqrtPriceX96, tick), `liquidity`, `tickSpacing`, `fee`, and the initialised tick bitmap and `ticks` entries spanning the simulated range.
5. **Quote cross-check** (optional): aggregator sell quotes at fixed notionals.
6. **Volatility series**: historical daily returns of the underlying for the stress quantile.
7. **Protocol configuration**: guardrails, caps, buffers, quantiles, lookbacks, all versioned.

No other input may influence the output. In particular: no model output, no discretionary override, no manual price.

---

## 4. The regime machine

### 4.1 States

| State | Meaning |
|---|---|
| `DEEP` | Underlying in its main session, depth at or above target, sources fresh and agreeing |
| `NORMAL` | Underlying open, depth adequate |
| `THIN` | Underlying open but depth below the thin threshold, or spread and dispersion elevated |
| `PRE_TRANSITION` | Last Call: a known weakening starts within the cure window |
| `REFERENCE_CLOSED` | Underlying market closed, token still trading |
| `ACTION` | Corporate action or multiplier activation window |
| `HALTED` | Underlying halted, or the adapter reports a token-level halt |
| `STALE` | Sources too old or dispersed beyond tolerance |
| `RECOVERY` | Cooldown after a reopening or after leaving `STALE` or `HALTED` |

### 4.2 Resolution order

Evaluated top to bottom; the first match wins.

```
1. HALTED            if adapter halt flag or underlying halt flag
2. STALE             if max(source age) > staleness_max
                     or |reference - pool| / reference > dispersion_max
3. ACTION            if now within [action_start, action_end] from the corporate action schedule
                     or the multiplier changed within action_cooldown
4. PRE_TRANSITION    if next_weakening_start - now <= cure_window(asset)
5. RECOVERY          if now - last_reopen <= recovery_cooldown
6. REFERENCE_CLOSED  if the underlying market is not in any session
7. THIN              if C(1%) < thin_threshold(asset) or spread > spread_max
8. DEEP              if C(1%) >= deep_threshold(asset) and underlying in main session
9. NORMAL            otherwise
```

### 4.3 Transition asymmetry

Tightening (to a weaker regime or lower capacity) applies immediately on the next report.
Loosening (to a stronger regime or higher capacity) applies only after `recovery_cooldown` has elapsed and the last `n_confirm` consecutive reports agree, and never by more than `max_loosen_step` per report.

This asymmetry is mandatory. It is what stops a single favourable observation from opening the credit taps.

---

## 5. Executable depth

### 5.1 Single-hop V3 simulation

For each venue pool holding the asset, simulate a sell of the asset into the quote token by walking ticks from `slot0.sqrtPriceX96` in the direction of the sale, consuming the active liquidity in each tick range and applying the pool fee, until the requested notional is filled or liquidity is exhausted.

Output for a ladder of notionals (default: 1k, 2.5k, 5k, 10k, 25k, 50k, 100k, 250k in quote units):

```
impact(n) = (mid_price_before - realised_price(n)) / mid_price_before
```

Then:

```
C(i) = max { n in R+ : impact(n) <= i }     found by bisection on the simulation
```

Report `C(0.5%)`, `C(1%)`, `C(3%)`.

### 5.2 Multi-hop paths

If the quote token is not the loan asset (for example `COINx/xETH`, `SLVx/USDC` against a USDG loan), simulate each leg and compound:

```
impact_total(n) = 1 - (1 - impact_leg1(n)) * (1 - impact_leg2(n'))
```

where `n'` is the output of leg 1. Record the path explicitly in the report. A path whose second leg cannot be simulated is excluded, and its exclusion is recorded.

### 5.3 Aggregation and haircut

```
C_raw(i)   = sum over eligible venues of C_venue(i)
C(i)       = C_raw(i) * fragmentation_factor        (default 0.8 when more than one venue, else 1.0)
```

Venues are eligible only if their state was observed within `staleness_max`. Concentrated-liquidity positions that sit entirely outside a plausible sale range still count only to the extent the simulation reaches them, which is the point of simulating rather than reading TVL.

### 5.4 Cross-check

If aggregator quotes are available, compute `|C_sim - C_quote| / C_quote`. If it exceeds `crosscheck_max`, take the minimum of the two and flag `crosscheck_divergence` in the report. Never take the maximum.

---

## 6. Credit Mark

```
P_ref     = median(reference observations that are fresh)
P_pool    = pool mid price, TWAP over twap_window where available, else spot
dispersion = |P_ref - P_pool| / P_ref

if dispersion > dispersion_max  -> regime = STALE
P_base    = min(P_ref, P_pool)                       // conservative by construction
haircut   = h_regime + h_dispersion * dispersion
CreditMark = P_base * (1 - haircut)
band      = [CreditMark * (1 - b_regime), P_base]
```

`h_regime` is a small configured haircut per regime (illustratively 0 for DEEP, 0.25% for NORMAL, 0.75% for THIN, 1.5% for REFERENCE_CLOSED, 2.5% for ACTION). The Credit Mark is used for collateral valuation only. The reported reference price is displayed separately so users can see both.

Wrapped collateral is valued as:

```
USD value = wrapper.convertToAssets(shares) * CreditMark(underlying token)
```

The wrapper exchange rate is never used as a price on its own, and legacy v1 wrappers are never integrated.

---

## 7. Capacity

### 7.1 Stress capacity

```
H          = hours until the next window where depth >= deep_threshold is expected (from the Clock)
g(a, H)    = empirical quantile q of |log return| of the underlying over comparable
             intervals of length H, from at least lookback_years of daily data
v(a)       = clamp( realised_vol_20d / median_realised_vol_5y , v_min, v_max )
s          = impact at the reference liquidation size for this asset
stressLTV  = 1 - ( v(a) * g(a, H) + s + liquidation_bonus + buffer )
```

Defaults: `q = 0.99`, `lookback_years = 5`, `v_min = 0.75`, `v_max = 2.0`, `buffer = 0.02`.

### 7.2 Liquidity capacity

```
debtCeiling = k * C(1%)              default k = 0.75
```

Interpretation: total debt against an asset must stay below the notional that can actually be sold at one percent impact, times a safety factor. This is the enforcement of the coverage ratio and it is the clause that makes "never lend more than you can liquidate" a rule rather than a slogan.

### 7.3 Position capacity

```
maxPositionDebt = min( positionCap_abs , positionCap_share * C(1%) )
```

so that no single position can exceed a configured share of the exit path.

### 7.4 Carry and Session Max

```
carryLTV      = min( stressLTV(H_next_weak)  , LT - carry_margin )
sessionMaxLTV = min( stressLTV(H_next_cure) , LT - session_margin )
```

where `H_next_weak` is the horizon through the next weaker regime and `H_next_cure` is the horizon to the next Last Call window. By construction `carryLTV <= sessionMaxLTV <= LT`.

`LT`, the liquidation threshold, is a fixed per-asset constant set at listing and changed only by timelocked governance. KTS never returns a value of `LT`. It returns capacities under it.

### 7.5 Clamping

Every output is clamped to the contract guardrails for that asset (`ltv_min`, `ltv_max`, `ceiling_min`, `ceiling_max`, `max_loosen_step`). A computed value outside guardrails is clamped, and the clamping is recorded in the report.

---

## 8. Cure covenant

When a borrower draws credit above `carryLTV`, the position records:

```
carryTarget     = carryLTV at the time of the draw
cureDeadline    = start of the next PRE_TRANSITION window for that asset
```

Rules:

- At `cureDeadline`, if `positionLTV > min(carryTarget, current carryLTV)`, the position is eligible for **Cure**.
- Cure repays only the amount required to reach that target, and pays `cure_bonus` (default 1.5 percent) to the curer.
- Cure is permissionless. Any party may execute it. Kerb does not privilege its own keeper.
- Cure eligibility disappears the moment the borrower brings the position to target by repaying or adding collateral.
- If the position also breaches `LT`, the ordinary **Default** liquidation path applies instead, with `default_bonus` (default 7 percent) and the configured close factor.

The borrower always sees, before signing: the current regime, the next cure deadline, the exact cure amount at the current mark, and the difference between choosing Carry and Session Max.

---

## 9. Report schema

```json
{
  "kts": "0.1",
  "engineVersion": "kerb-engine@<semver>+<gitsha>",
  "chainId": 196,
  "asset": "0x...",
  "assetSymbol": "KOx",
  "underlying": { "symbol": "KO", "market": "XNYS", "multiplier": "1.0" },
  "observedAt": "2026-09-21T14:05:00Z",
  "regime": "NORMAL",
  "regimeInputs": {
    "calendarSession": "REGULAR",
    "nextTransition": { "type": "SESSION_CLOSE", "at": "2026-09-21T20:00:00Z" },
    "nextWeakening": { "type": "REFERENCE_CLOSED", "at": "2026-09-22T00:00:00Z" },
    "cureWindowOpensAt": "2026-09-21T19:00:00Z",
    "sourceMaxAgeSec": 41,
    "dispersion": "0.0011"
  },
  "mark": {
    "reference": { "value": "68.42", "sources": ["chainlink:KO/USD"], "label": "Verified" },
    "pool": { "value": "68.39", "twapWindowSec": 900, "label": "Observed" },
    "creditMark": "68.22",
    "band": ["67.54", "68.42"],
    "haircut": "0.0029"
  },
  "depth": {
    "venues": [{ "dex": "uniswap-v3", "pool": "0x...", "fee": 500, "path": ["KOx", "USDG"] }],
    "impactCurve": [
      { "notional": "1000", "impact": "0.0008" },
      { "notional": "5000", "impact": "0.0031" },
      { "notional": "25000", "impact": "0.0262" }
    ],
    "C_0_5": "2900", "C_1": "9100", "C_3": "27400",
    "fragmentationFactor": "1.0",
    "crosscheck": { "source": "okx-dex", "delta": "0.07", "flag": false }
  },
  "capacity": {
    "LT": "0.70",
    "carryLTV": "0.42",
    "sessionMaxLTV": "0.58",
    "debtCeiling": "6825",
    "maxPositionDebt": "2275",
    "coverageRatioAtCeiling": "1.33",
    "clamped": []
  },
  "stress": {
    "horizonHours": "62",
    "quantile": "0.99",
    "gapQuantile": "0.061",
    "volScaler": "1.18",
    "liquidationBonus": "0.07",
    "buffer": "0.02"
  },
  "inputsBundleCID": "bafy...",
  "inputsHash": "0x...",
  "attester": "0x...",
  "signature": "0x..."
}
```

All numeric fields are decimal strings. Ratios are fractions of one, not percentages.

---

## 10. Reproducibility

1. The engine writes an **input bundle**: a canonical JSON document containing every input listed in Section 3, exactly as observed, with source identifiers and timestamps.
2. The bundle is canonicalised (sorted keys, no whitespace, decimal strings), hashed with keccak256, stored and served by the Kerb API under that hash, and pinned to IPFS when the pinning quota allows (paused since 21 Sep).
3. The report carries `inputsHash` and `inputsBundleCID`, and the attester signs `(chainId, asset, observedAt, inputsHash, outputsHash)` under EIP-712.
4. `KerbTerms` stores `inputsHash` in the event and in storage.
5. `kerb verify <reportId>` fetches the bundle, recomputes, and prints a diff. Any difference is a failure.

The engine must therefore be a pure function of the bundle. No clock reads, no network calls, no randomness inside the computation path. Time enters only as an input field.

---

## 11. Guardrails enforced onchain

The contract, not the engine, is the final authority:

| Guardrail | Meaning |
|---|---|
| `ltvMin`, `ltvMax` | Absolute bounds on any posted LTV |
| `ceilingMin`, `ceilingMax` | Absolute bounds on the debt ceiling |
| `maxLoosenStepBps` | Maximum increase per report |
| `loosenCooldownSec` | Minimum time between increases |
| `maxReportAgeSec` | Reports older than this cannot gate a borrow |
| `attesterSet` | Which keys may post |
| `LT` | Fixed liquidation threshold, timelocked |

A posted report that violates any guardrail reverts. The engine is allowed to be wrong; the contract is not allowed to let it be dangerous.

---

## 12. Versioning and governance of the standard

- `kts` semver in every report. Breaking changes to formulas bump the minor version and appear in `CHANGELOG-KTS.md`.
- Parameter changes (quantiles, factors, thresholds) are configuration, not code, and are versioned in the bundle so old reports remain reproducible under the parameters they used.
- The standard is published under an open licence. Kerb's hosted operation, history and calibration are the commercial layer.

---

## 13. Worked example (illustrative only, not measured)

```
Asset KOx on X Layer, underlying KO on XNYS, Friday 19:10 UTC.
Calendar: regular session ends 20:00 UTC, post-market to 00:00 UTC, then closed until Monday 13:30 UTC.
Next weakening: REFERENCE_CLOSED at 00:00 UTC, H = 61.5 hours to Monday's open.
Depth: C(1%) = 9,100 USDG, impact at 25k = 2.6%.
Stress: 99th percentile |move| over a 61.5 hour closed interval = 6.1%, vol scaler 1.18.
stressLTV = 1 - (1.18*0.061 + 0.007 + 0.07 + 0.02) = 0.831 -> clamped by LT 0.70 and margins
carryLTV = 0.42, sessionMaxLTV = 0.58, debtCeiling = 0.75 * 9,100 = 6,825 USDG.
At 19:00 UTC the cure window opened. A Session Max position at 0.55 LTV must cure to 0.42 by 20:00 UTC.
Cure amount at the current mark: repay 214 USDG or add 337 USDG of collateral.
```

Every number above is a placeholder for layout and teaching. Real values come from the engine and are labelled `Computed`.

---

## 14. Known limitations of v0.1

- Single-chain. Cross-chain exit paths are not modelled.
- Fragmentation factor is a constant, not an estimate of correlated withdrawal.
- The stress quantile assumes the underlying's historical gap distribution is informative for the tokenized wrapper. Wrapper-specific basis risk is not yet modelled.
- Depth is simulated against current pool state and does not model liquidity that would be added in response to the trade, nor liquidity that would flee.
- `ACTION` handling in v0.1 is conservative: it pauses new borrowing rather than modelling the action's economics.

These are stated here, on `/proof`, and in the README. A standard that hides its limitations is marketing.
