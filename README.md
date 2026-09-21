# Kerb

[![CI](https://github.com/Franlinozz/Kerb/actions/workflows/ci.yml/badge.svg)](https://github.com/Franlinozz/Kerb/actions/workflows/ci.yml)
### Credit on the market's clock

Kerb is the market-time risk layer for tokenized securities on X Layer. It observes each asset's
underlying market session, its executable liquidity in the real X Layer pools, and the quality of
its price sources, then converts all three into reproducible onchain credit terms, and lends
against them.

> **Never lend more than you can liquidate.**

**Live:** [www.usekerb.xyz](https://www.usekerb.xyz) · API [api.usekerb.xyz](https://api.usekerb.xyz)
· built for OKX Dev Day 2026, Build a Market.

---

## What it does

1. **Session.** Every asset's underlying market runs on its own calendar: NYSE, Nasdaq, NYSE Arca,
   and HKEX with its lunch break as a first-class session boundary. Kerb resolves where each asset
   is in that calendar, on chain and off, from the same resolver.
2. **Depth.** It walks the real Uniswap V3 pools on X Layer tick by tick in the direction of a sale
   and asks what the largest notional is whose realised impact is at most *i*. That is C(i), and it
   is cross-checked against an independent aggregator quote, and the smaller of the two always wins.
3. **Mark.** It takes the conservative minimum of a reference median and the pool price along the
   whole path to the loan asset, after a dispersion guard and a regime haircut.
4. **Terms.** Those become a Carry capacity that survives the next weakening unattended, a higher
   Session Max capacity for the current session, and a debt ceiling capped by what the market could
   actually absorb. They are signed and posted on chain under the Kerb Terms Standard.
5. **Credit.** Kerb Credit lends against them. Borrowers choose Carry, which is never disturbed, or
   Session Max, which precommits to **Last Call**: before the session weakens, anyone may cure the
   position back to its Carry target for a small bonus.

**The liquidation threshold never moves with the session.** Sessions move borrowing capacity and
the cure covenant, never the line under a live borrower. Changing it is a timelocked admin action.

## Why it exists

Tokenized equities trade around the clock. The conditions you would have to liquidate them in do
not. Lending protocols in production treat 3am Sunday and 3pm Wednesday as the same collateral, and
size credit against a price rather than against an exit. Kerb measures the difference.

Market-Time Report #1 measured it: across 42 hours and 35,130 readings of a closed weekend,
in-range liquidity fell on 7 of 10 asset pools, the largest by 49%. A capacity number fixed at
Friday's close would have been wrong for the whole weekend.
[Read it →](https://www.usekerb.xyz/reports/1)

## Deployments

| Contract | Network | Address | Verified |
|---|---|---|---|
| KerbClock | X Layer mainnet 196 | `0xf765d374e0ce576860a463f0d796ad45c62161b8` | Sourcify exact match |
| KerbTerms | X Layer mainnet 196 | `0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5` | Sourcify exact match |
| KerbClock | X Layer testnet 1952 | `0x6c1de992e3219980138d7e51b67ecc523618bc5c` | Sourcify exact match |
| KerbTerms | X Layer testnet 1952 | `0x5a4942f55e37994370745ef984a21321edb75f7e` | Sourcify exact match |
| KerbCredit | X Layer testnet 1952 | `0xa1314645cd6c07e651359aba540e2600090b98a8` | source in repo |
| KerbClockDemo | X Layer testnet 1952 | `0xd2483b2d8bd759f87fadb21117498a5db36bcb0f` | testnet only, never mainnet |
| kKOx / kHKEXCx mirrors | X Layer testnet 1952 | `0x11827f0f…af4a16` / `0x80da4036…9360f2` | mirror collateral |

Loan asset: USDG (`0x4ae46a509F6b1D9056937BA4500cb143933D2dc8`) on mainnet. Builder Code
`kt0hl6xyhlx8xmt` is attached as an ERC-8021 suffix to every transaction Kerb sends.

## Verify a Kerb report yourself

Every report pins its complete input bundle to IPFS and puts the keccak256 of those canonical bytes
on chain alongside the terms. Take the `inputsHash` from any `TermsPosted` event:

```
pnpm --filter @kerb/engine kerb verify <inputsHash>
```

That resolves the CID the bundle was pinned under, fetches the bytes from a public IPFS gateway,
checks they hash to that CID, recomputes every number from them, and prints the result next to
what is on chain. A value the attester clamped tighter into the onchain guardrails is reported as
clamped, not as a mismatch: the contract may be more conservative than the engine, never less.

## Repository

| Path | What |
|---|---|
| `apps/collector` | Append-only observation loops: pool state 60s, prices 30s, quotes 5m, multipliers 10m |
| `apps/engine` | KTS-0.1 as pure functions, the report builder, `kerb report` and `kerb verify` |
| `apps/attester` | Signs reports, pins bundles, posts them on chain, deploy and lifecycle scripts |
| `apps/api` | Public read API: board, terms, clock, report, credit, proof |
| `apps/indexer` | Chain events into Postgres, reorg-aware and restartable |
| `apps/web` | The Board, Market, Methodology, Reports and Proof pages |
| `packages/v3math` | Exact Uniswap V3 tick-walk simulation and C(i) by bisection |
| `packages/calendar` | Per-market trading calendars and the Clock resolver |
| `contracts` | KerbClock, KerbTerms, KerbCredit, KerbMirror, KerbClockDemo |
| `docs/KTS-0.1.md` | The Kerb Terms Standard |
| `SECURITY.md` | Key model, Slither dispositions, known limitations |

## Run it locally

```
pnpm install
pnpm typecheck && pnpm test && pnpm lint
pnpm chain:ping                          # latest block on X Layer 196 and 1952
cd contracts && forge test               # 106 contract tests, including 8 invariants
DATABASE_URL=... pnpm db:migrate
DATABASE_URL=... pnpm collector          # fixture mode, replays committed real captures
KERB_LIVE=1 DATABASE_URL=... pnpm collector
```

## Tests

494 TypeScript and 106 Solidity tests. They include the 1,000-timestamp fuzz proving the onchain
`KerbClock` agrees with the TypeScript resolver, a recompute test asserting ten historical bundles
reproduce byte-identically, eight Kerb Credit invariants under a guided handler, and fork tests
against the real xStocks wrapper and the live mainnet `KerbTerms`.

## Limitations

The credit plane runs on X Layer testnet with clearly labelled mirror collateral: the builder does
not acquire or route around restrictions on the production tokenized assets. These contracts are
**unaudited**; the mainnet deployment is the risk plane only and holds no user funds. Current
degradation rungs and every other limitation are stated live on
[/proof](https://www.usekerb.xyz/proof) and in [`SECURITY.md`](SECURITY.md).

## Attribution

viem (MIT), wagmi (MIT), decimal.js (MIT), drizzle-orm (Apache-2.0), postgres.js (Unlicense),
Fastify (MIT), Next.js (MIT), React (MIT), TanStack Query (MIT), tsx (MIT), Vitest (MIT),
TypeScript (Apache-2.0), ESLint (MIT), OpenZeppelin Contracts (MIT), Foundry forge-std (MIT/Apache-2.0),
Playwright (Apache-2.0). Data sources: xStocks public API, X Layer RPC, Uniswap v3 contracts on
X Layer, the OKX DEX aggregator quote API, and the Yahoo Finance chart endpoint (third-party
reference, no SLA, not redistributed; see `data/SOURCES.md`).
