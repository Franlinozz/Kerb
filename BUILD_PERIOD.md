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
