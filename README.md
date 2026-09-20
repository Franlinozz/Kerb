# Kerb
### Credit on the market's clock

Kerb is the market-time risk layer for tokenized securities on X Layer. It observes each asset's underlying market session, its executable liquidity in real X Layer pools and the quality of its price sources, and converts them into reproducible onchain credit terms (KTS-0.1).

> Never lend more than you can liquidate.

Status: in active build for OKX Dev Day 2026 (Build a Market). See `BUILD_PERIOD.md` for what was built when, and `PROJECT_STATE.md` for the current state.

## Repository

| Path | What |
|---|---|
| `apps/collector` | Append-only observation loops: pool state 60s, prices 30s, multipliers 10m, `/health` |
| `packages/types` | Decimal helpers, provenance labels, `Regime`, `assetId` |
| `packages/adapters` | X Layer chain config, `AssetAdapter` + `XStocksAdapter`, Uniswap v3 pool snapshot reader, reference clients |
| `config/assets.json` | The ten tracked assets, every address confirmed onchain with an explorer link |
| `contracts` | Foundry project (contracts land from phase 3) |
| `KTS-0.1.md` | The Kerb Terms Standard |

## Run locally

```
pnpm install
pnpm typecheck && pnpm test && pnpm lint
pnpm chain:ping                         # latest block on X Layer 196 and 1952
DATABASE_URL=... pnpm db:migrate
DATABASE_URL=... pnpm collector         # fixture mode, replays committed real captures
KERB_LIVE=1 DATABASE_URL=... pnpm collector
```

## Attribution

viem (MIT), decimal.js (MIT), drizzle-orm (Apache-2.0), postgres.js (Unlicense), tsx (MIT), Vitest (MIT), TypeScript (Apache-2.0), ESLint (MIT), Foundry forge-std (MIT/Apache-2.0). Data sources: xStocks public API, X Layer RPC, Uniswap v3 contracts on X Layer, Yahoo Finance chart endpoint (third-party reference, no SLA).

## Verify a Kerb report yourself

Every Market-Time Report pins its complete input bundle to IPFS and puts the keccak256 of those
canonical bytes on chain with the report. Take the `inputsHash` from any `TermsPosted` event and:

```
pnpm --filter @kerb/engine kerb verify <inputsHash>
```

That resolves the CID the bundle was pinned under, fetches the bytes from a public IPFS gateway,
checks they hash to that CID, recomputes every number from them, and prints the recomputed values
next to the ones on chain. A value the attester clamped tighter into the onchain guardrails is
reported as clamped, not as a mismatch: the contract is allowed to be more conservative than the
engine, never less.
