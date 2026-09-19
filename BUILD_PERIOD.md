# BUILD_PERIOD.md
## What was built when

Official build period: 18 Sep 2026 to 25 Sep 2026 23:59 UTC (OKX Dev Day 2026, Build a Market).
Planning documents were committed on 18 Sep. Product code starts on 19 Sep. One line per functionality, UTC.

| Date (UTC) | Task | What was built |
|---|---|---|
| 19 Sep | K-01 | pnpm workspace (Node 22, TS strict, exactOptionalPropertyTypes), apps and packages scaffold, Foundry project with forge-std, ESLint, Vitest, `.env.example` |
| 19 Sep | K-01 | `packages/types`: shared decimal module (decimal.js, no floats on value paths), provenance labels, `Regime` enum matching KTS-0.1 4.1, `assetId = keccak256(abi.encode(chainId, token))`, canonical JSON |
| 19 Sep | K-02 | X Layer mainnet (196) and testnet (1952) viem clients, explorer link helpers, `pnpm chain:ping` |
| 19 Sep | K-03 | Asset discovery: ten campaign pools resolved from the xStocks issuer API and the Uniswap v3 factory, each confirmed onchain (token0, token1, fee, tickSpacing, slot0, liquidity, factory); `config/assets.json` |
| 19 Sep | K-04 | `packages/adapters`: `AssetAdapter` interface and `XStocksAdapter` (issuer API + token and wrapper contracts), Uniswap v3 pool snapshot reader pinned to one block, Yahoo and Pyth reference clients |
| 19 Sep | K-05 | `apps/collector`: pool (60s), price (30s) and multiplier (10m) loops writing append-only rows with source, timestamp, keccak content hash and raw payload blob; DB triggers reject UPDATE, DELETE, TRUNCATE; fixture mode by default, `KERB_LIVE=1` for live |
| 19 Sep | K-06 | Collector live on the VPS under PM2 from 06:37 UTC, `/health` with per-source ages and row counts, freshness alarm at 5 minutes |
| 19 Sep | K-07 | `packages/v3math`: exact bigint Uniswap v3 exact-input simulation walking initialised ticks from slot0; matches QuoterV2 to the wei on 150 quotes over 15 real X Layer pools at one pinned block; refuses to step into unobserved bitmap words |
| 19 Sep | K-07 | `C(i)` by bisection with the guarantee impact(C) <= i; impact curve at the KTS default ladder |
| 19 Sep | K-08 | Multi-hop paths (asset -> xETH -> USDG, asset -> USDC -> USDG) with compounded impact and recorded path; venue aggregation with the fragmentation factor; exclusions recorded with reasons |
| 19 Sep | K-08 | OKX DEX quote client (signed, v6) and quote-curve capacity with the min-never-max cross-check rule; runs on rung 2 until credentials exist |
| 19 Sep | K-09 | `packages/calendar`: XNYS, XNAS, ARCX, XHKG (lunch break first class, half days), XCOM (CME Globex metals) for 2026 to 2027, DST via the IANA database; holiday overrides cross-checked against Pyth's published market-hours schedules |
| 19 Sep | K-10 | Clock resolver: session, next transition, next weakening, next reference close, cure window, horizon H; pure function of (market, time) |
| 19 Sep | K-08 | `apps/engine` depth assembly from live observations with staleness, dust and route exclusions; `pnpm --filter @kerb/engine depth-report` |
