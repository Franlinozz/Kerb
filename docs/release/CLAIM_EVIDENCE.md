# Claim evidence

Every public claim on the site, in the README and in the submission text, mapped to something a
reader can check. Anything that could not be backed was changed or removed from the copy.
Checked 22 Sep 2026 on commit given in RELEASE_STATE.md. `/proof` re-checks the live ones on every load.

| Claim | Where it appears | Evidence |
|---|---|---|
| KerbClock and KerbTerms are live on X Layer mainnet | Home, Proof, README, submission | Mainnet addresses in RELEASE_STATE.md; Sourcify exact match links on `/proof`; `/v1/proof` `onchain.deployments` |
| Terms are posted on chain every few minutes for ten live xStocks pools | Home, Board, README, submission | 3,085 mainnet posts by 22 Sep 15:14 UTC (`/health`, `/v1/proof` `postCounts`); `/v1/tape` shows the newest; e.g. `0x4d960ba3f5f98f122511067b34ad04b6817bf134373f78a857b154fab4515628` |
| Every post carries Builder Code `kt0hl6xyhlx8xmt` (ERC-8021) | Proof, README, submission | Decoded from each recent post's own calldata on `/proof` (Latest Terms posts, one column per row); decoder test in `apps/attester` |
| C(1%) comes from a tick-by-tick walk of the real Uniswap V3 pool, cross-checked against the OKX DEX aggregator, smaller wins | Methodology, README, submission | `packages/v3math` (matches QuoterV2 to the wei on 150 quotes, BUILD_PERIOD K-07); `/v1/report/196/:asset` `depth.venues` and `crosscheck` |
| The Credit Mark is the lower of reference median and pool price, less a regime haircut | Methodology, README | `apps/engine/src/mark.ts`; the live waterfall on `/methodology#mark` and `/asset/:symbol#mark` from `/v1/report` |
| KTS 0.2: margins follow the horizon each mode must survive; before a long closure Carry tightens | Home, Methodology, README | Live since 21 Sep 19:38 UTC; first 0.2 post `0x6212668a35862bb6753ffb84ec9843665df3b3bff9fed5999bb65a5fca139577`; KOx at the 20:00 UTC close, Carry 55.60% to 51.57% and Session Max 61.20% to 54.47% (`0x70acaeaa...d6c9c5` to `0xfcc7616f...6f40`); `docs/v2/KTS-0.2.md` |
| 0.2 was replayed over 3,286 real bundles and posted 1,357 times through the real KerbTerms on a fork with no contract revert | Methodology | `data/reports/kts-0.2-replay.json` and `.svg`; `data/reports/kts-0.2-fork*.json` (1,357 of 1,359 posted, 2 local-node transport failures, 0 reverts) |
| Any number recomputes from its published inputs with one command | Home, Methodology, Proof, README, submission | `pnpm --filter @kerb/engine kerb verify <inputsHash>`; `/proof` "Recompute" tile runs the same comparison on the latest report (all fields match or clamped tighter on chain) |
| Every bundle posted since K-43 is retrievable from its inputsHash | Proof | `/v1/proof` `pinning`: 2,719 of 2,719 in the last 24 h at 15:14 UTC; `/v1/bundle/:hash` |
| The observation store is append-only | Proof | Triggers rejecting UPDATE, DELETE, TRUNCATE in `apps/collector` migrations; row counts on `/proof` |
| The liquidation threshold is fixed and never moves with the session | Home, Credit, Methodology, README, submission | `KerbCredit` stores LT per listed asset with no session input; relisting reverts `AlreadyListed` (V2-00); the Credit page and API show the LT read from chain |
| A Session Max position can be cured by anyone at Last Call for a bonus, only the difference | Credit, Methodology, README, submission | Four real browser runs on 22 Sep: a second wallet cured from the public table, e.g. cure `0xa38cab227449f853996f756f674250704b033671325d040efa0841a2a16c503e` (`data/credit-flow-2026-09-22.json`, shown on `/proof`) |
| The credit plane is testnet with mirror collateral, relayed from mainnet | Credit, Proof, README, footer | `kerb-mirror-relay` (PM2) posts mainnet terms to testnet every five minutes; the testnet drawer on `/credit`; `/v1/credit/1952` `loanAsset.isMock`, `contracts.clockIsDemo` |
| Market-Time Report #1: 7 of 10 asset pools lost in-range liquidity over a closed weekend, the largest by 49% | Home, Research, README, submission | `data/reports/market-time-1.json` (`/v1/market-time/1`): MIXUx -49.12%, 35,130 readings, 42.25 h; C(1%) appendix added 22 Sep, figures unchanged |
| 545 TypeScript and 106 Solidity tests; 47 E2E | README, Proof | `data/test-report.json`; CI runs on every push (badge); E2E count from `pnpm --filter @kerb/web e2e` |
| Zero serious or critical accessibility issues on every route in both themes | README | `apps/web/e2e/a11y.spec.ts` in CI |
| Mainnet contracts hold no user funds | Proof, README | KerbClock and KerbTerms have no token transfer paths; credit is testnet only |
| Unaudited | Footer, Proof, README | Stated; no audit claimed anywhere |

Removed or changed during V2 because they could not be backed as written: the "Interim card" social
card text (replaced with art), a margin sentence that described 0.1 while 0.2 is live, the Report #2
headline (it is written only from the generated report on 24 Sep).
