# PROJECT_STATE.md
## Living state. Update at every checkpoint. A new agent must be able to resume from this file alone.

Last updated: 19 Sep 2026 07:00 UTC, end of phase 0.

---

## 1. Where we are

| Item | Status |
|---|---|
| Phase | 0 complete, 1 next |
| Tier | T0 in progress |
| Collector | LIVE on VPS under PM2 (`kerb-collector`) since 2026-09-19 06:37:30 UTC. Health: `curl 127.0.0.1:8710/health` |
| Mainnet risk plane | not deployed |
| Testnet credit plane | not deployed |
| Web | not started |
| Kerb Desk (OKX AI) | not started, P1 |
| Participation route | undecided, deadline 24 Sep |
| Demo video | not recorded |

---

## 2. Addresses and links (fill as they exist, never guess)

| Thing | Network | Address / URL | Verified |
|---|---|---|---|
| KerbClock | X Layer mainnet 196 | | |
| KerbTerms | X Layer mainnet 196 | | |
| KerbClock | X Layer testnet 1952 | | |
| KerbTerms | X Layer testnet 1952 | | |
| KerbCredit | X Layer testnet 1952 | | |
| KerbClockDemo | X Layer testnet 1952 | | |
| kKOx mirror | X Layer testnet 1952 | | |
| kHKEXCx mirror | X Layer testnet 1952 | | |
| USDG | X Layer mainnet | 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8 | yes |
| USDG | X Layer testnet | 0xF0863D7A29a55d0c4263c11bFac754312ff078DF | yes |
| Builder Code (mainnet) | dev portal | | |
| Builder Code (testnet) | registerAuto on 0x00a3b805dbf39e5d54f9d09c130ff2132b4a0a21 | | |
| Repo | | github.com/Franlinozz/Kerb | yes |
| App | | https://userkerb.xyz (DNS not yet pointed) | |
| API | | | |

---

## 3. Assets under observation

| Symbol | Underlying | Market | Pool | Quote | Pool address | First observation |
|---|---|---|---|---|---|---|
| KOx | KO | XNYS | Uniswap V3 0.05% (on the V2 wrapper wKOx) | USDG | [0x273DA512f76129ED59a2D93D68dFe198423a3114](https://www.oklink.com/xlayer/address/0x273DA512f76129ED59a2D93D68dFe198423a3114) | 2026-09-19 06:37 UTC |
| HKEXCx | 388 (HKEX) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wHKEXCx) | USDG | [0x293A6167Bed3A474b99f450dE817BC4474087Ed4](https://www.oklink.com/xlayer/address/0x293A6167Bed3A474b99f450dE817BC4474087Ed4) | 2026-09-19 06:37 UTC |
| BRK.Bx | BRK.B | XNYS | Uniswap V3 0.05% (on the V2 wrapper wBRK.Bx) | USDG | [0x34Fa7515d3364648F558aa876F73feC12e2bA507](https://www.oklink.com/xlayer/address/0x34Fa7515d3364648F558aa876F73feC12e2bA507) | 2026-09-19 06:37 UTC |
| MIXUx | 2097 (Mixue) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wMIXUx) | USDG | [0x94D64ac04AC580a72fd481bCd1Ca7d83Bd4ac3b8](https://www.oklink.com/xlayer/address/0x94D64ac04AC580a72fd481bCd1Ca7d83Bd4ac3b8) | 2026-09-19 06:37 UTC |
| KUAIx | 1024 (Kuaishou) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wKUAIx) | USDG | [0x9D5d95416412643004af849e012c894D4689a0f2](https://www.oklink.com/xlayer/address/0x9D5d95416412643004af849e012c894D4689a0f2) | 2026-09-19 06:37 UTC |
| ICEx | ICE | XNYS | Uniswap V3 0.05% (on the V2 wrapper wICEx) | USDG | [0x8D0167755eD35c534FE59DCf5a49EC6aed56736f](https://www.oklink.com/xlayer/address/0x8D0167755eD35c534FE59DCf5a49EC6aed56736f) | 2026-09-19 06:37 UTC |
| SHEINx | 625 (SHEIN) | XHKG | Uniswap V3 0.05% (on the V2 wrapper wSHEINx) | USDG | [0xF1ef85ce4691E94a32064b59E766c42183B44497](https://www.oklink.com/xlayer/address/0xF1ef85ce4691E94a32064b59E766c42183B44497) | 2026-09-19 06:37 UTC |
| COINx | COIN | XNAS | Uniswap V3 0.05% (on the V2 wrapper wCOINx) | xETH | [0x70131C43684B9Ba44677345f9b05f16E2b555edF](https://www.oklink.com/xlayer/address/0x70131C43684B9Ba44677345f9b05f16E2b555edF) | 2026-09-19 06:37 UTC |
| BMNRx | BMNR | XNYS | Uniswap V3 0.05% (on the V2 wrapper wBMNRx) | xETH | [0xcd5a3694a98986598D1F73A27438ba4BBbfa729b](https://www.oklink.com/xlayer/address/0xcd5a3694a98986598D1F73A27438ba4BBbfa729b) | 2026-09-19 06:37 UTC |
| SLVx | SLV (iShares Silver Trust) | ARCX | Uniswap V3 0.05% (on the V2 wrapper wSLVx) | USDC | [0xd510189E8b3684A101e0552835f3B6C2dE4af4a6](https://www.oklink.com/xlayer/address/0xd510189E8b3684A101e0552835f3B6C2dE4af4a6) | 2026-09-19 06:37 UTC |

Leg-two routes: xETH/USDG `0x6E18CEbFb9C5BBcf127b97a6daB026E941FfF6D5` (0.05%), USDC/USDG `0xbB9a35F790EA6eA9763b99e885f33BCF95860d40` (0.01%). Extra venues also observed: COINx/USDC, COINx/USDG (dust), BMNRx/USDG (dust). Full detail in `config/assets.json`.

Market codes and underlying identifiers must be confirmed by the adapter against the issuer's data, not assumed from the ticker.

---

## 4. Degradation rungs currently in force

| Subsystem | Rung | Note |
|---|---|---|
| Reference price | 2 (issuer data) plus a third-party check | xStocks price-data (returns quote:null for 7 of 10 on weekends) plus Yahoo chart as an independent Observed reference. Pyth Hermes now requires an API key (401); Chainlink Data Streams needs credentials |
| Executable depth | not yet computed | Pool state and ticks recorded every 60s; tick-walk arrives in phase 1 |
| Loan asset on testnet | | |
| Credit market deployment | | |
| Corporate action data | 1 partial + 2 | xStocks multiplier endpoint gives current, next and activation time; full corporate-actions endpoint needs an API key. Onchain multiplier() and wrapper convertToAssets polled every 10m |

---

## 5. Decisions

Format: date, decision, reason, alternatives considered, consequence.

| Date | Decision | Reason |
|---|---|---|
| 18 Sep | Build a Market is the primary track | The product is a market and a risk primitive on X Layer; OKX AI participates only through the optional Kerb Desk |
| 18 Sep | Liquidation threshold is fixed, sessions move capacity and the cure covenant | Moving a liquidation line under a live borrower is indefensible and a technical judge will probe it first |
| 18 Sep | Depth is computed from Uniswap V3 pool state by tick-walk, not from an aggregator estimate | Reproducible, defensible, and the hardest component to copy |
| 18 Sep | Credit plane on testnet with mirror collateral | Backed lists Nigeria as non-serviceable; the builder does not acquire or route around the restriction |
| 18 Sep | Builder Codes are P0 | X Layer documents the ERC-8021 integration with viem and both mainnet and testnet registration paths |
| | | |

---

## 6. Telegram answers from OKX

| Date | Question | Answer | Source |
|---|---|---|---|
| | Testnet credit plane plus mainnet data plane acceptable for Build a Market? | | |
| | Official xStocks testnet deployment on X Layer? | | |
| | Canonical wrapper addresses and preferred reference source? | | |
| | Exchange OS or Trade Zone sandbox access? | | |
| | Finale 6 Oct or 7 Oct? | | |
| | Invitation letter for a Singapore visa? | | |

---

## 7. Deviations log

One line each, every time the build departs from the plan.

| Date | Deviation | Why |
|---|---|---|
| 19 Sep | Collector started 06:37 UTC Sat, not before Fri 20:00 UTC close. The record has no data from Fri 20:00 to Sat 06:37 UTC | Build began after the close; nothing before 06:37 can be recreated and none will be backfilled |
| 19 Sep | Doc files renamed to the canonical names the pack uses (AGENTS.md, KERB-MASTER-PLAN.md, ARCHITECTURE.md, BUILD_PLAN.md, PROJECT_STATE.md, DEMO.md, SUBMISSION.md) | The committed files had different casing from every cross-reference |
| 19 Sep | Pools trade the xStocks V2 wrapper (wKOx etc.), not the rebasing token. Config records both; `poolToken: wrapper` | Found onchain; the base-token pools are empty or absent |
| 19 Sep | SLVx underlying is the iShares Silver Trust ETF on ARCX (NYSE Arca, US equity hours), not XCOM. SHEINx is XHKG. BMNRx is XNYS per issuer | Issuer data (xStocks exchange MIC), per PROJECT_STATE instruction to confirm against issuer |
| 19 Sep | Independent reference is Yahoo chart (unofficial, no SLA), not Pyth | Pyth Hermes price endpoints return 401 without a key. Pyth feed IDs kept in config; Pyth switches on when PYTH_API_KEY is set |
| 19 Sep | HK underlying prices recorded in HKD with a separate USD/HKD FX observation; conversion belongs to the engine (Computed) | Keep observations raw |
| 19 Sep | ARCHITECTURE.md does not spell out the AssetAdapter interface; it is derived from KTS-0.1 section 3.1 plus the halt flags from 4.2 | Gap in the spec |
| 19 Sep | Raw payload blobs are stored gzipped in Postgres (`blobs`, id `keccak256:0x...`) until IPFS pinning (K-14) | Smallest thing that records today |
| 19 Sep | Extra tables `obs_source_error` and `collector_cycles` (append-only) | Failures must be recorded, and gaps must be measurable |
| 19 Sep | One row with mode='test' in obs_source_error from verifying the append-only trigger; it cannot be deleted by design | Trigger verification |

---

## 8. Open blockers

| Blocker | Hypotheses tested | Current rung | Owner |
|---|---|---|---|
| OKX DEX quote API needs credentials (OK-ACCESS-KEY) | Public endpoint returns 50103 | Depth rung 2 until keys provided | Operator |
| Pyth Hermes price data needs an API key | v2 latest, legacy api/latest_price_feeds, hermes-beta and benchmarks all return 401 | Yahoo in use | Operator (optional) |

---

## 9. Checkpoint history

Paste each phase CHECKPOINT block here, newest first, so a fresh agent can read the build backwards.
