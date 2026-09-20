# Data sources and licences

Every number Kerb publishes carries a provenance label (AGENTS.md section 2.3). This file
records where each input comes from, under what terms, and what is redistributed.

| Input | Source | Access | Redistributed in this repo | Note |
|---|---|---|---|---|
| Pool state (slot0, liquidity, ticks, fee, tickSpacing) | X Layer RPC, Uniswap v3 pools on chain 196 | Public RPC | Yes: `data/fixtures/` snapshots | Public chain state. `Verified`. |
| Token and wrapper state (multiplier, convertToAssets, decimals, paused) | X Layer RPC | Public RPC | Yes: fixtures | Public chain state. `Verified`. |
| Asset profile, multiplier schedule, issuer price | xStocks public API (`api.xstocks.fi`) | Public, no key | Yes: captured responses in fixtures | Issuer data. `Observed`. Corporate-action endpoints need an API key we do not have. |
| Independent reference price | Yahoo Finance chart endpoint | Public, unofficial, no SLA | No | See "Reference and history" below. `Observed`. |
| Underlying daily bars (stress statistics) | Yahoo Finance chart endpoint | Public, unofficial | **No** | See below. |
| Market hours and holiday cross-check | Pyth feed catalogue (`hermes.pyth.network/v2/price_feeds`) | Public, no key | Yes: `data/fixtures/calendar/` | Used only to verify our calendars, never as a price. |
| Aggregator sell quotes (depth cross-check) | OKX DEX aggregator API | Needs credentials, not yet provided | n/a | Depth is on rung 2 until then. |

## Reference and history

Yahoo's terms do not grant redistribution rights, so Kerb **does not commit the raw daily
bar dataset to this repository and does not publish it in report bundles**. Instead:

- Bars are ingested into the append-only `ref_daily_bars` table on the Kerb VPS
  (`pnpm --filter @kerb/collector ingest-history`), with the raw payload stored as a blob
  and hashed.
- A report bundle pins the *derived* stress inputs (gap quantile, volatility scaler, sample
  sizes, the date range used) plus a keccak256 digest of the canonical series, so the engine
  stays a pure function of the bundle and every published number is recomputable from it.
  The series behind the digest is reproducible by anyone who ingests the same source.
- When a licensed source is available (operator to supply an API key for a provider whose
  terms permit redistribution), the series itself will be pinned in the bundle and this
  limitation removed. This is recorded as a degradation rung on `/proof`.

## History actually available (ingested 2026-09-20)

| Underlying | Bars | From | Note |
|---|---|---|---|
| KO, BRK.B, ICE, SLV | 2,514 | 2016-09-19 | full 5-year lookback satisfied |
| 0388.HK (HKEX) | 2,463 | 2016-09-19 | full |
| 1024.HK (Kuaishou) | 1,380 | 2021-02-05 | full |
| COIN | 1,365 | 2021-04-14 | full |
| 2097.HK (Mixue) | 383 | 2025-03-03 | **short**, listed 2025 |
| BMNR | 324 | 2025-06-05 | **short** |
| 0625.HK (SHEIN) | 14 | 2026-09-01 | **very short**, listed Sep 2026 |

KTS-0.1 section 7.1 asks for at least five years. Three underlyings cannot supply it because
they have not existed that long. Kerb does not invent history: an asset with insufficient
history uses the most conservative gap quantile observed across the covered universe at the
same horizon (never its own, if its own is smaller), and the report records
`historySufficient: false` with the sample size.
